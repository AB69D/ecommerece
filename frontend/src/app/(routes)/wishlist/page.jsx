"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiHeart, FiTrash2, FiArrowLeft, FiEye } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import {
    getWishlist,
    removeFromWishlist,
    clearWishlist,
    writeWishlistIds,
} from "@/services/wishlist";

export default function WishlistPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const { symbol } = useCurrency();
    const router = useRouter();

    // Keep the shared id cache (and every heart) in step with this page.
    const syncIds = useCallback((list) => {
        writeWishlistIds(new Set((list || []).map((it) => String(it.productId))));
    }, []);

    const load = useCallback(async () => {
        try {
            const res = await getWishlist();
            if (res?.success && res.data) {
                setItems(res.data.items || []);
                syncIds(res.data.items || []);
            }
        } catch {
            /* leave empty */
        } finally {
            setLoading(false);
        }
    }, [syncIds]);

    useEffect(() => {
        load();
    }, [load]);

    const remove = async (productId) => {
        setBusy(true);
        try {
            const res = await removeFromWishlist(productId);
            if (res?.success && res.data) {
                setItems(res.data.items || []);
                syncIds(res.data.items || []);
            }
        } catch {
            /* ignore */
        } finally {
            setBusy(false);
        }
    };

    const clearAll = async () => {
        setBusy(true);
        try {
            const res = await clearWishlist();
            if (res?.success) {
                setItems([]);
                writeWishlistIds(new Set());
            }
        } catch {
            /* ignore */
        } finally {
            setBusy(false);
        }
    };

    const netPrice = (it) =>
        (it.price || 0) - (it.price || 0) * ((it.discountPercent || 0) / 100);

    if (loading) {
        return (
            <div className="w-full py-12 sm:py-20 flex items-center justify-center">
                <div className="w-9 h-9 border-4 border-gray-200 border-t-rose-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="w-full py-12 sm:py-20 flex flex-col items-center justify-center text-center px-4">
                <FiHeart className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Your wishlist is empty</h2>
                <p className="text-gray-500 mb-5">Tap the heart on any product to save it for later.</p>
                <button
                    onClick={() => router.push("/")}
                    className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700"
                >
                    Browse products
                </button>
            </div>
        );
    }

    return (
        <div className="w-full py-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <FiHeart className="w-6 h-6 text-rose-500" />
                    <h1 className="text-2xl font-bold text-gray-800">My Wishlist</h1>
                    <span className="text-gray-400 text-sm">({items.length})</span>
                </div>
                <button
                    onClick={clearAll}
                    disabled={busy}
                    className="text-sm text-gray-400 hover:text-red-500 disabled:opacity-50"
                >
                    Clear all
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {items.map((it) => {
                    const hasDiscount = (it.discountPercent || 0) > 0;
                    return (
                        <div
                            key={it.productId}
                            className="group bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 flex flex-col"
                        >
                            <Link href={`/product/${it.productId}`} className="relative block aspect-square bg-gray-100 overflow-hidden">
                                {it.productImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={it.productImage}
                                        alt={it.productName}
                                        loading="lazy"
                                        decoding="async"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                        No Image
                                    </div>
                                )}
                                {hasDiscount && (
                                    <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full">
                                        -{it.discountPercent}%
                                    </span>
                                )}
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        remove(it.productId);
                                    }}
                                    disabled={busy}
                                    aria-label="Remove from wishlist"
                                    className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-sm text-rose-500 hover:bg-white hover:text-red-600 disabled:opacity-50"
                                >
                                    <FiTrash2 className="w-4 h-4" />
                                </button>
                            </Link>

                            <div className="p-2.5 sm:p-3 flex flex-col flex-1">
                                <Link
                                    href={`/product/${it.productId}`}
                                    className="font-medium text-gray-800 text-xs sm:text-sm line-clamp-2 hover:text-emerald-700"
                                >
                                    {it.productName || "Product"}
                                </Link>
                                {it.category && (
                                    <p className="text-[10px] sm:text-xs text-emerald-600 mt-0.5 truncate">{it.category}</p>
                                )}
                                <div className="mt-1.5">
                                    {hasDiscount ? (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] sm:text-sm text-gray-400 line-through">{symbol}{it.price}</span>
                                            <span className="text-sm sm:text-base font-bold text-emerald-600">{symbol}{netPrice(it).toFixed(0)}</span>
                                        </div>
                                    ) : it.price ? (
                                        <span className="text-sm sm:text-base font-bold text-gray-900">{symbol}{it.price}</span>
                                    ) : null}
                                </div>
                                <Link
                                    href={`/product/${it.productId}`}
                                    className="mt-auto pt-2.5 inline-flex items-center justify-center gap-1.5 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium transition-colors"
                                >
                                    <FiEye className="w-3.5 h-3.5" />
                                    View product
                                </Link>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mt-8">
                <button
                    onClick={() => router.push("/")}
                    className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50"
                >
                    <FiArrowLeft className="w-4 h-4" />
                    Continue shopping
                </button>
            </div>
        </div>
    );
}
