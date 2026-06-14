"use client";
import React, { useState, useEffect, useRef } from "react";
import Link, { useStorePush } from "@/components/StoreLink";
import { useParams } from "next/navigation";
import { FiShoppingCart, FiCheck, FiHelpCircle, FiMessageCircle, FiPhoneCall, FiPackage, FiArrowLeft } from "react-icons/fi";
import { PiWhatsappLogoBold } from "react-icons/pi";
import { addToCart } from "@/utils/cart";
import { trackViewContent, trackAddToCart } from "@/lib/tracking";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import ProductReviews from "@/components/ProductReviews.jsx";
import WishlistButton from "@/components/WishlistButton.jsx";
import { useWhatsApp } from "@/hooks/useWhatsApp";

export default function ProductClient({ productId }) {
    const wa = useWhatsApp();
    const { store = "" } = useParams() || {};
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedWeight, setSelectedWeight] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);
    const [qaExpanded, setQaExpanded] = useState({});
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [relatedLoading, setRelatedLoading] = useState(false);
    const { symbol, code } = useCurrency();
    const goTo = useStorePush();
    const productRef = useRef(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                if (!productId) return;
                
                const res = await fetch(`/api/client/product/product/${productId}`, {
                    headers: store ? { 'X-Tenant': store } : {},
                });
                const data = await res.json();
                
                if (data.success) {
                    setProduct(data.data);
                    if (productRef.current) {
                        productRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                    if (data.data.category?._id) {
                        fetchRelatedProducts(data.data.category._id, productId);
                    }
                } else {
                    setError(data.message);
                }
            } catch (err) {
                setError("Failed to fetch product");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

    const fetchRelatedProducts = async (categoryId, currentProductId) => {
        setRelatedLoading(true);
        try {
            const res = await fetch(`/api/client/product/products?category=${categoryId}&limit=8`, {
                headers: store ? { 'X-Tenant': store } : {},
            });
            const data = await res.json();
            if (data.success) {
                const filtered = data.data.filter(p => p._id !== currentProductId).slice(0, 4);
                setRelatedProducts(filtered);
            }
        } catch (err) {
            console.error("Failed to fetch related products", err);
        } finally {
            setRelatedLoading(false);
        }
    };

        if (productId) {
            fetchProduct();
        }
    }, [productId]);

    // Fire the Meta Pixel "ViewContent" event once the product has loaded
    // (browser + server-side via the shared tracking helper).
    useEffect(() => {
        if (product?._id) {
            trackViewContent(product, { currency: code, price: product.weights?.[0]?.price });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?._id]);

    const handleAddToCart = async () => {
        if (!product || !product.weights[selectedWeight]) return;

        setAdding(true);
        try {
            const guestId = (() => {
                let id = localStorage.getItem('guestId');
                if (!id) {
                    id = `guest_${Date.now()}`;
                    localStorage.setItem('guestId', id);
                }
                return id;
            })();

            const res = await fetch(`/api/client/cart/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'guest-id': guestId,
                    ...(store ? { 'X-Tenant': store } : {}),
                },
                body: JSON.stringify({
                    productId: product._id,
                    productName: product.firstName,
                    productImage: product.cover_image,
                    quantity: quantity,
                    weight: product.weights[selectedWeight].weight,
                    weightIndex: selectedWeight,
                    price: product.weights[selectedWeight].price,
                    discountPercent: product.weights[selectedWeight].discountPercent || 0
                })
            });
            const data = await res.json();

            if (data.success) {
                const w = product.weights[selectedWeight];
                const effPrice = (w.price || 0) * (1 - (w.discountPercent || 0) / 100);
                trackAddToCart({ productId: product._id, name: product.firstName, price: effPrice, quantity, currency: code });
                setAdded(true);
                setTimeout(() => setAdded(false), 2000);
                window.dispatchEvent(new Event('cart-updated'));
            } else {
                alert(data.message || 'Failed to add to cart');
            }
        } catch (err) {
            alert('Failed to add to cart');
        } finally {
            setAdding(false);
        }
    };

    const handleCashOnDelivery = async () => {
        if (!product || !product.weights[selectedWeight]) return;
        
        const currentWeight = product.weights[selectedWeight];
        if (!currentWeight?.stock || currentWeight.stock < 1) {
            alert('This size is out of stock');
            return;
        }

        setAdding(true);
        try {
            const guestId = (() => {
                let id = localStorage.getItem('guestId');
                if (!id) {
                    id = `guest_${Date.now()}`;
                    localStorage.setItem('guestId', id);
                }
                return id;
            })();

            const res = await fetch(`/api/client/cart/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'guest-id': guestId,
                    ...(store ? { 'X-Tenant': store } : {}),
                },
                body: JSON.stringify({
                    productId: product._id,
                    productName: product.firstName,
                    productImage: product.cover_image,
                    quantity: quantity,
                    weight: currentWeight.weight,
                    weightIndex: selectedWeight,
                    price: currentWeight.price,
                    discountPercent: currentWeight.discountPercent || 0
                })
            });
            const data = await res.json();

            if (data.success) {
                const effPrice = (currentWeight.price || 0) * (1 - (currentWeight.discountPercent || 0) / 100);
                trackAddToCart({ productId: product._id, name: product.firstName, price: effPrice, quantity, currency: code });
                window.dispatchEvent(new Event('cart-updated'));
                goTo('/checkout');
            } else {
                alert(data.message || 'Failed to proceed');
            }
        } catch (err) {
            alert('Failed to proceed');
        } finally {
            setAdding(false);
        }
    };

    const goToCart = () => {
        goTo('/cart');
    };

    const toggleQA = (index) => {
        setQaExpanded(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    if (loading) {
        return (
            <div className="w-full min-h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                    <p className="text-gray-500">Loading...</p>
                </div>
            </div>
        );
    }

    if (error || !product) {
        return (
            <div className="w-full min-h-[70vh] flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-md text-center">
                    <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                        <FiPackage className="h-9 w-9 text-emerald-600" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                        Product not available
                    </h1>
                    <p className="mt-2 text-sm sm:text-base text-gray-500">
                        This product may have been removed or is no longer sold online.
                    </p>
                    <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                        >
                            <FiArrowLeft className="h-4 w-4" />
                            Continue shopping
                        </Link>
                        <Link
                            href="/search"
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            Browse products
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const currentWeight = product.weights?.[selectedWeight];
    const allImages = currentWeight?.images?.length > 0 
        ? currentWeight.images 
        : (product.cover_image ? [product.cover_image] : []);

    return (
        <div ref={productRef} className="w-full py-6 sm:py-8 px-4 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
                <div className="order-1">
                    <div className="aspect-square bg-gray-100 rounded-lg sm:rounded-xl overflow-hidden mb-3 sm:mb-4">
                        {allImages.length > 0 ? (
                            <img
                                src={allImages[selectedImage]}
                                alt={product.firstName}
                                loading="eager"
                                decoding="async"
                                fetchPriority="high"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                No Image
                            </div>
                        )}
                    </div>
                    
                    {allImages.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {allImages.map((img, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedImage(index)}
                                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                                        selectedImage === index ? 'border-emerald-600' : 'border-transparent hover:border-gray-300'
                                    }`}
                                >
                                    <img
                                        src={img}
                                        alt={`${product.firstName} ${index + 1}`}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="order-2">
                    {product.category && (
                        <p className="text-xs sm:text-sm text-emerald-600 font-medium mb-2">
                            {product.category.category_name}
                        </p>
                    )}

                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                        {product.firstName}
                    </h1>
                    {product.lastName && (
                        <p className="text-base sm:text-lg text-gray-600 mt-1">
                            {product.lastName}
                        </p>
                    )}

                    <div className="mt-6 sm:mt-8">
                        {product.weights && product.weights.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select Size/Weight
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {product.weights.map((weight, index) => (
                                        <button
                                            key={index}
                                            onClick={() => {
                                                setSelectedWeight(index);
                                                setSelectedImage(0);
                                                setQuantity(1); // Reset quantity when changing size
                                            }}
                                            className={`px-3 sm:px-4 py-2 rounded-lg border text-sm transition-all ${
                                                selectedWeight === index 
                                                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700' 
                                                    : 'border-gray-300 text-gray-700 hover:border-emerald-400'
                                            }`}
                                        >
                                            {weight.weight} - {symbol}{weight.price}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-5 sm:mt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quantity
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors text-lg font-medium"
                            >
                                -
                            </button>
                            <span className="w-12 text-center text-lg font-medium">
                                {quantity}
                            </span>
                            <button
                                onClick={() => setQuantity(Math.min(currentWeight?.stock || 10, quantity + 1))}
                                className="w-10 h-10 rounded-lg border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors text-lg font-medium"
                            >
                                +
                            </button>
                            <button
                                onClick={handleCashOnDelivery}
                                disabled={adding || !currentWeight?.stock}
                                className="ml-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Cash on Delivery
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 sm:mt-6">
                        {currentWeight?.stock > 0 ? (
                            <p className="text-sm text-emerald-600">
                                ✓ In Stock ({currentWeight.stock} available)
                            </p>
                        ) : (
                            <p className="text-sm text-red-500">
                                ✗ Out of Stock
                            </p>
                        )}
                    </div>

                    <div className="mt-5 sm:mt-6">
                        {currentWeight?.discountPercent > 0 ? (
                            <div className="flex items-center gap-3">
                                <p className="text-lg sm:text-xl text-gray-400 line-through">
                                    {symbol}{currentWeight?.price * quantity || 0}
                                </p>
                                <p className="text-2xl sm:text-3xl font-bold text-emerald-600">
                                    {symbol}{(currentWeight.price - (currentWeight.price * currentWeight.discountPercent / 100)) * quantity}
                                </p>
                                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded">
                                    -{currentWeight.discountPercent}%
                                </span>
                            </div>
                        ) : (
                            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                                {symbol}{currentWeight?.price * quantity || 0}
                            </p>
                        )}
                    </div>

                    <div className="mt-6 sm:mt-8 flex flex-col gap-3">
                         <div className="flex gap-3">
                             <button
                                 onClick={added ? goToCart : handleAddToCart}
                                 disabled={adding || !currentWeight?.stock}
                                 className="flex-1 min-w-0 bg-emerald-600 text-white font-medium py-3 sm:py-3.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                             >
                                 {adding ? 'Adding...' : added ? <><FiCheck className="w-5 h-5" /> Added</> : currentWeight?.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
                             </button>
                             {wa.enabled && (
                                 <a
                                     href={wa.chatUrl(`Hi, I'd like to know more about ${product?.firstName}.`)}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="flex-1 min-w-0 bg-green-500 hover:bg-green-600 text-white text-sm sm:text-base font-medium py-3 sm:py-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-center"
                                 >
                                     <PiWhatsappLogoBold className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                     <span>Chat on WhatsApp</span>
                                 </a>
                             )}
                         </div>
                         {product && <WishlistButton product={product} variant="detail" className="w-full" />}
                         <div className="flex gap-3">
                             {wa.contactPhone && (
                                 <a
                                     href={`tel:${wa.contactPhone.replace(/\s/g, "")}`}
                                     className="flex-1 min-w-0 bg-emerald-700 hover:bg-emerald-800 text-white text-sm sm:text-base font-medium py-3 sm:py-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-center shadow-sm hover:shadow-md"
                                     aria-label="Call to order"
                                 >
                                     <FiPhoneCall className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                                     <span>Call to Order</span>
                                 </a>
                             )}
                             <a
                                 href={`https://m.me/ab9d-ecommerce?text=${encodeURIComponent(`Hi, I'd like to know more about ${product?.firstName}.`)}`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="flex-1 min-w-0 bg-blue-500 hover:bg-blue-600 text-white text-sm sm:text-base font-medium py-3 sm:py-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors text-center shadow-sm hover:shadow-md"
                             >
                                 <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                     <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/>
                                 </svg>
                                 <span>Messenger</span>
                             </a>
                         </div>
                     </div>

                    {product.description && (
                        <div className="mt-8 sm:mt-10">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                Description
                            </h3>
                            <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                                {product.description}
                            </p>
                        </div>
                    )}

                    {product.qa && product.qa.length > 0 && (
                         <div className="mt-8 sm:mt-10">
                             <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                 <FiHelpCircle className="w-5 h-5 text-emerald-600" />
                                 Questions & Answers
                             </h3>
                             <div className="space-y-3">
                                 {product.qa.map((item, index) => (
                                     <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                                         <button
                                             onClick={() => toggleQA(index)}
                                             className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                                         >
                                             <span className="font-medium text-gray-800 text-sm sm:text-base pr-4">
                                                 Q: {item.question}
                                             </span>
                                             <span className={`w-6 h-6 flex items-center justify-center text-gray-500 transition-transform ${qaExpanded[index] ? 'rotate-180' : ''}`}>
                                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                 </svg>
                                             </span>
                                         </button>
                                         {qaExpanded[index] && (
                                             <div className="p-4 bg-white border-t border-gray-200">
                                                 <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                                                     A: {item.answer}
                                                 </p>
                                             </div>
                                         )}
                                     </div>
                                 ))}
                             </div>
                         </div>
                     )}

                     {relatedProducts.length > 0 && (
                         <div className="mt-10 sm:mt-12">
                             <h3 className="text-xl font-bold text-gray-800 mb-6">Related Products</h3>
                             {relatedLoading ? (
                                 <div className="flex items-center justify-center py-8">
                                     <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                                 </div>
                             ) : (
                                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 fade-in-stagger">
                                     {relatedProducts.map((item) => (
                                         <Link
                                             key={item._id}
                                             href={`/product/${item._id}`}
                                             className="card-hover group border border-gray-100 rounded-xl overflow-hidden bg-white"
                                         >
                                             <div className="aspect-square bg-gray-100 overflow-hidden">
                                                 <img
                                                     src={item.cover_image || (item.weights?.[0]?.images?.[0]) || '/logo.png'}
                                                     alt={item.firstName}
                                                     loading="lazy"
                                                     decoding="async"
                                                     className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                 />
                                             </div>
                                             <div className="p-3">
                                                 <h4 className="text-sm font-medium text-gray-800 truncate">{item.firstName}</h4>
                                                 {item.lastName && (
                                                     <p className="text-xs text-gray-600 truncate">{item.lastName}</p>
                                                 )}
                                                 <p className="text-sm font-bold text-emerald-600 mt-1">
                                                     {symbol}{item.weights?.[0]?.price || 0}
                                                 </p>
                                             </div>
                                         </Link>
                                     ))}
                                 </div>
                             )}
                         </div>
                     )}
                </div>
            </div>

            <ProductReviews productId={product._id} productName={product.firstName} />
        </div>
    );
}