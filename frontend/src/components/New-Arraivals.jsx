"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiArrowLeft, FiArrowRight, FiEye, FiPlus } from "react-icons/fi";
import { useStorePush } from "@/components/StoreLink";
import ProductCardSkeleton from "./ProductCardSkeleton";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import ProductRating from "./ProductRating.jsx";
import WishlistButton from "./WishlistButton.jsx";

export default function NewArraivals() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [productsPerView, setProductsPerView] = useState(2);
    const [hoveredProduct, setHoveredProduct] = useState(null);
    const { symbol } = useCurrency();
    const goTo = useStorePush();
    const sliderRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width >= 1024) {
                setProductsPerView(4);
            } else if (width >= 768) {
                setProductsPerView(3);
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

    useEffect(() => {
        if (products.length <= productsPerView) return;
        const timer = setInterval(() => {
            setCurrentIndex(prev => {
                const next = prev + productsPerView;
                return next >= products.length ? 0 : next;
            });
        }, 2000);
        return () => clearInterval(timer);
    }, [products.length, productsPerView]);

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
        goTo(`/product/${productId}`);
    };

    const getMinDiscountedWeight = (weights) => {
        if (!weights || weights.length === 0) return null;
        return weights.reduce((min, w) => {
            const minPrice = min.price - (min.price * (min.discountPercent || 0) / 100);
            const currentPrice = w.price - (w.price * (w.discountPercent || 0) / 100);
            return currentPrice < minPrice ? w : min;
        }, weights[0]);
    };

    const totalPages = Math.ceil(products.length / productsPerView);
    const currentPage = Math.floor(currentIndex / productsPerView);

    if (loading) {
        return (
            <div className="w-full py-8 px-4 overflow-hidden">
                <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                    <div className="w-9 h-9 rounded-full bg-gray-100" />
                    <div className="flex flex-col items-center text-center px-2">
                    <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--theme-accent)" }}>Just In</span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">New Arrivals</h2>
                    <span className="mt-2 h-1 w-14 rounded-full" style={{ background: "linear-gradient(to right, var(--theme-primary), var(--theme-accent))" }} />
                </div>
                    <div className="w-9 h-9 rounded-full bg-gray-100" />
                </div>
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {Array.from({ length: productsPerView }).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
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
        <div className="w-full py-8 px-4 overflow-hidden">
            <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                <button
                    onClick={() => scroll('left')}
                    disabled={!canScrollLeft}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Scroll left"
                >
                    <FiArrowLeft className="w-5 h-5 text-gray-700" />
                </button>
                <div className="flex flex-col items-center text-center px-2">
                    <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--theme-accent)" }}>Just In</span>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">New Arrivals</h2>
                    <span className="mt-2 h-1 w-14 rounded-full" style={{ background: "linear-gradient(to right, var(--theme-primary), var(--theme-accent))" }} />
                </div>
                <button
                    onClick={() => scroll('right')}
                    disabled={!canScrollRight}
                    className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    aria-label="Scroll right"
                >
                    <FiArrowRight className="w-5 h-5 text-gray-700" />
                </button>
            </div>

            <div className="max-w-7xl mx-auto relative">
                <div className="overflow-hidden rounded-lg">
                    <div
                        ref={sliderRef}
                        className="flex transition-transform duration-500 ease-in-out"
                        style={{ transform: `translateX(-${currentIndex * (100 / productsPerView)}%)` }}
                    >
                        {products.map((product) => {
                            const productImage = product.cover_image || (product.weights && product.weights[0]?.images?.[0]) || null;
                            const minWeight = getMinDiscountedWeight(product.weights);
                            const hasDiscount = minWeight && minWeight.discountPercent > 0;

                            return (
                                <div
                                    key={product._id}
                                    className="flex-shrink-0 px-1.5 sm:px-2"
                                    style={{ width: `${100 / productsPerView}%` }}
                                >
                                    <div
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

                                            {hasDiscount && (
                                                <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                                                    -{minWeight.discountPercent}%
                                                </div>
                                            )}

                                            <WishlistButton product={product} className="absolute top-2 right-2" />
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
                                            <ProductRating productId={product._id} className="mt-1" />
                                            <div className="mt-2 text-center">
                                                {minWeight && (
                                                    hasDiscount ? (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <p className="text-sm text-gray-400 line-through">{symbol}{minWeight.price}</p>
                                                            <p className="text-base font-bold text-emerald-600">
                                                                {symbol}{(minWeight.price - (minWeight.price * minWeight.discountPercent / 100)).toFixed(0)}
                                                            </p>
                                                        </div>
                                                    ) : (
                                                        <p className="text-base font-bold text-gray-900">{symbol}{minWeight.price}</p>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-5">
                        {Array.from({ length: totalPages }, (_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i * productsPerView)}
                                className={`rounded-full transition-all duration-300 focus:outline-none ${currentPage === i
                                        ? "w-5 h-2 sm:w-6 sm:h-3 bg-emerald-600 shadow-md"
                                        : "w-2 h-2 sm:w-3 sm:h-3 bg-gray-300 hover:bg-gray-400"
                                    }`}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
