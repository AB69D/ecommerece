"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FiEye, FiPlus } from "react-icons/fi";
import { ProductGridSkeleton } from "./ProductCardSkeleton";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import ProductRating from "./ProductRating.jsx";
import WishlistButton from "./WishlistButton.jsx";

export default function AllProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [hoveredProduct, setHoveredProduct] = useState(null);
    const { symbol } = useCurrency();
    const router = useRouter();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`/api/client/product/products?limit=50`);
                const data = await res.json();

                if (data.success) {
                    setProducts(data.data);
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

    const goToProduct = (productId) => {
        router.push(`/product/${productId}`);
    };

    const getMinDiscountedWeight = (weights) => {
        if (!weights || weights.length === 0) return null;
        return weights.reduce((min, w) => {
            const minPrice = min.price - (min.price * (min.discountPercent || 0) / 100);
            const currentPrice = w.price - (w.price * (w.discountPercent || 0) / 100);
            return currentPrice < minPrice ? w : min;
        }, weights[0]);
    };

    if (loading) {
        return (
            <div className="w-full py-8 px-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center mb-6">All Products</h2>
                <ProductGridSkeleton count={10} />
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
                <p className="text-gray-500">No products available</p>
            </div>
        );
    }

    return (
        <div className="w-full py-8 px-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 text-center mb-6">All Products</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 max-w-7xl mx-auto fade-in-stagger">
                {products.map((product) => {
                    const productImage = product.cover_image || (product.weights && product.weights[0]?.images?.[0]) || null;
                    const minWeight = getMinDiscountedWeight(product.weights);
                    const hasDiscount = minWeight && minWeight.discountPercent > 0;
                    
                    return (
                        <div
                            key={product._id}
                            onClick={() => goToProduct(product._id)}
                            onMouseEnter={() => setHoveredProduct(product._id)}
                            onMouseLeave={() => setHoveredProduct(null)}
                            className="card-hover bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer"
                        >
                            <div className="relative aspect-square bg-gray-100 overflow-hidden">
                                {productImage ? (
                                    <img
                                        src={productImage}
                                        alt={product.firstName}
                                        loading="lazy"
                                        decoding="async"
                                        className={`w-full h-full object-cover transition-transform duration-300 ${hoveredProduct === product._id ? 'scale-110' : ''}`}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        No Image
                                    </div>
                                )}

                                {hoveredProduct === product._id && (
                                    <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-3 sm:pb-4 gap-2 sm:gap-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                goToProduct(product._id);
                                            }}
                                            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-white hover:bg-emerald-600 hover:text-white text-gray-800 text-[10px] sm:text-xs font-medium rounded-full transition-colors"
                                        >
                                            <FiEye className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                            Quick View
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                goToProduct(product._id);
                                            }}
                                            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full transition-colors"
                                        >
                                            <FiPlus className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                                        </button>
                                    </div>
                                )}

                                {hasDiscount && (
                                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full">
                                        -{minWeight.discountPercent}%
                                    </div>
                                )}

                                <WishlistButton product={product} className="absolute top-2 right-2" />
                            </div>

                            <div className="p-2.5 sm:p-3 flex flex-col items-center">
                                <h3 className="font-semibold text-gray-800 text-xs sm:text-sm text-center truncate w-full">
                                    {product.firstName}
                                </h3>
                                {product.lastName && (
                                    <p className="text-[11px] sm:text-xs text-gray-500 truncate text-center w-full">
                                        {product.lastName}
                                    </p>
                                )}
                                {product.category && (
                                    <p className="text-[11px] sm:text-xs text-emerald-600 mt-0.5 truncate text-center">
                                        {product.category.category_name}
                                    </p>
                                )}
                                <ProductRating productId={product._id} className="mt-1" />
                                <div className="mt-1.5 sm:mt-2 text-center">
                                    {minWeight && (
                                        hasDiscount ? (
                                            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
                                                <p className="text-[11px] sm:text-sm text-gray-400 line-through">{symbol}{minWeight.price}</p>
                                                <p className="text-sm sm:text-base font-bold text-emerald-600">
                                                    {symbol}{(minWeight.price - (minWeight.price * minWeight.discountPercent / 100)).toFixed(0)}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-sm sm:text-base font-bold text-gray-900">{symbol}{minWeight.price}</p>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
