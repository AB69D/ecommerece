"use client";
import React, { useState, useEffect, useCallback } from "react";
import { FiArrowLeft, FiArrowRight, FiEye, FiPlus } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import ProductRating from "@/components/ProductRating.jsx";

export default function HoneySweetsPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [productsPerView, setProductsPerView] = useState(2);
    const [hoveredProduct, setHoveredProduct] = useState(null);
    const { symbol } = useCurrency();
    const router = useRouter();

    const containerRef = React.useRef(null);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width >= 1024) {
                setProductsPerView(4);
            } else {
                setProductsPerView(2);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/client/product/products?limit=20`);
                const data = await res.json();

                if (data.success) {
                    const catRes = await fetch(`/api/client/category/get-all-category`);
                    const catData = await catRes.json();
                    
                    if (catData.success) {
                        const cat = catData.data.find(c =>
                            c.category_name.toLowerCase().includes("honey") ||
                            c.category_name.toLowerCase().includes("sweet")
                        );
                        
                        if (cat) {
                            const filtered = data.data.filter(p => 
                                p.category?._id === cat._id || p.category === cat._id
                            );
                            setProducts(filtered);
                        } else {
                            setProducts([]);
                        }
                    }
                } else {
                    setError(data.message);
                }
            } catch (err) {
                setError("Failed to fetch products");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);

    const canScrollLeft = currentIndex > 0;
    const canScrollRight = currentIndex + productsPerView < products.length;

    const scroll = useCallback((direction) => {
        if (direction === 'left' && canScrollLeft) {
            setCurrentIndex(prev => Math.max(0, prev - productsPerView));
        } else if (direction === 'right' && canScrollRight) {
            setCurrentIndex(prev => Math.min(products.length - productsPerView, prev + productsPerView));
        }
    }, [canScrollLeft, canScrollRight, productsPerView, products.length]);

    const goToProduct = (productId) => {
        router.push(`/product/${productId}`);
    };

    if (loading) {
        return (
            <div className="w-full py-10 flex items-center justify-center">
                <p className="text-gray-500">Loading...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full py-10 flex items-center justify-center">
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    if (products.length === 0) {
        return (
            <div className="w-full py-10 flex items-center justify-center">
                <p className="text-gray-500">No products available in Honey & Sweets category</p>
            </div>
        );
    }

    const visibleProducts = products.slice(currentIndex, currentIndex + productsPerView);

    return (
        <div className="w-full py-8 px-4">
            <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                <button
                    onClick={() => scroll('left')}
                    disabled={!canScrollLeft}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Scroll left"
                >
                    <FiArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center">Honey & Sweets</h2>
                <button
                    onClick={() => scroll('right')}
                    disabled={!canScrollRight}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Scroll right"
                >
                    <FiArrowRight className="w-5 h-5 text-gray-700" />
                </button>
            </div>

            <div ref={containerRef} className="max-w-7xl mx-auto">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 fade-in-stagger">
                    {visibleProducts.map((product) => {
                        const productImage = product.cover_image || (product.weights && product.weights[0]?.images?.[0]) || null;
                        return (
                            <div
                                key={product._id}
                                onClick={() => goToProduct(product._id)}
                                onMouseEnter={() => setHoveredProduct(product._id)}
                                onMouseLeave={() => setHoveredProduct(null)}
                                className="card-hover bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm cursor-pointer"
                            >
                                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                    {productImage ? (
                                        <img
                                            src={productImage}
                                            alt={product.firstName}
                                            loading="lazy"
                                            decoding="async"
                                            className={`w-full h-full object-cover transition-transform duration-500 ${hoveredProduct === product._id ? 'scale-110' : ''}`}
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                                            No Image
                                        </div>
                                    )}

                                    {hoveredProduct === product._id && (
                                        <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-4 gap-3">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToProduct(product._id);
                                                }}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-emerald-600 hover:text-white text-gray-800 text-xs font-medium rounded-full transition-colors"
                                            >
                                                <FiEye className="w-3.5 h-3.5" />
                                                Quick View
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    goToProduct(product._id);
                                                }}
                                                className="flex items-center justify-center w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors"
                                            >
                                                <FiPlus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="p-3 flex flex-col items-center">
                                    <h3 className="font-medium text-gray-800 text-sm text-center truncate w-full">
                                        {product.firstName}
                                    </h3>
                                    {product.lastName && (
                                        <p className="text-xs text-gray-500 truncate text-center w-full">
                                            {product.lastName}
                                        </p>
                                    )}
                                    {product.category && (
                                        <p className="text-xs text-emerald-600 mt-1 text-center">
                                            {product.category.category_name}
                                        </p>
                                    )}
                                    <ProductRating productId={product._id} className="mt-1 justify-center" />
                                    <div className="mt-2">
                                        {product.weights && product.weights.length > 0 && (
                                            <p className="text-base font-bold text-gray-900 text-center">
                                                {symbol}{Math.min(...product.weights.map(w => w.price))}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
