"use client";
import { useState } from "react";
import { useStorePush } from "@/components/StoreLink";
import { FiEye, FiPlus } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import ProductRating from "./ProductRating.jsx";
import WishlistButton from "./WishlistButton.jsx";

// The cheapest variant once its own discount is applied — this is the "from"
// price the storefront shows (and what the server sorts price_asc/desc on).
const getMinDiscountedWeight = (weights) => {
    if (!weights || weights.length === 0) return null;
    return weights.reduce((min, w) => {
        const minPrice = min.price - (min.price * (min.discountPercent || 0) / 100);
        const currentPrice = w.price - (w.price * (w.discountPercent || 0) / 100);
        return currentPrice < minPrice ? w : min;
    }, weights[0]);
};

// Shared storefront product card: image with hover actions, discount badge,
// wishlist, rating and discounted pricing. Used by the homepage grids and the
// search / category browse pages so every product tile looks identical.
export default function ProductCard({ product, showCategory = true }) {
    const [hovered, setHovered] = useState(false);
    const { symbol } = useCurrency();
    const goTo = useStorePush();

    const goToProduct = () => goTo(`/product/${product._id}`);

    const productImage =
        product.cover_image || (product.weights && product.weights[0]?.images?.[0]) || null;
    const minWeight = getMinDiscountedWeight(product.weights);
    const hasDiscount = minWeight && minWeight.discountPercent > 0;

    return (
        <div
            onClick={goToProduct}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="card-hover bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer"
        >
            <div className="relative aspect-square bg-gray-100 overflow-hidden">
                {productImage ? (
                    <img
                        src={productImage}
                        alt={product.firstName}
                        loading="lazy"
                        decoding="async"
                        className={`w-full h-full object-cover transition-transform duration-300 ${hovered ? "scale-110" : ""}`}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                    </div>
                )}

                {hovered && (
                    <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-3 sm:pb-4 gap-2 sm:gap-3">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                goToProduct();
                            }}
                            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-white hover:bg-emerald-600 hover:text-white text-gray-800 text-[10px] sm:text-xs font-medium rounded-full transition-colors"
                        >
                            <FiEye className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            Quick View
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                goToProduct();
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
                {showCategory && product.category && (
                    <p className="text-[11px] sm:text-xs text-emerald-600 mt-0.5 truncate text-center">
                        {product.category.category_name}
                    </p>
                )}
                <ProductRating productId={product._id} className="mt-1" />
                <div className="mt-1.5 sm:mt-2 text-center">
                    {minWeight &&
                        (hasDiscount ? (
                            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
                                <p className="text-[11px] sm:text-sm text-gray-400 line-through">
                                    {symbol}
                                    {minWeight.price}
                                </p>
                                <p className="text-sm sm:text-base font-bold text-emerald-600">
                                    {symbol}
                                    {(minWeight.price - (minWeight.price * minWeight.discountPercent) / 100).toFixed(0)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm sm:text-base font-bold text-gray-900">
                                {symbol}
                                {minWeight.price}
                            </p>
                        ))}
                </div>
            </div>
        </div>
    );
}
