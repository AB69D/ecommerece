"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { FiHeart } from "react-icons/fi";
import {
    toggleWishlist,
    readWishlistIds,
    writeWishlistIds,
    isWishlistEnabled,
} from "@/services/wishlist";

// Pick the lowest-priced (after its own discount) variant as the snapshot we
// store on the wishlist — mirrors what the cards show as the "from" price.
const minWeight = (weights = []) => {
    if (!weights.length) return null;
    return weights.reduce((min, w) => {
        const a = (min.price || 0) - (min.price || 0) * ((min.discountPercent || 0) / 100);
        const b = (w.price || 0) - (w.price || 0) * ((w.discountPercent || 0) / 100);
        return b < a ? w : min;
    }, weights[0]);
};

// A self-contained heart toggle for any product card or the product page.
// Optimistically flips the local id cache (so the heart reacts instantly and
// every other heart for the same product stays in sync via the window event),
// then persists to the server and reverts on failure.
export default function WishlistButton({ product, variant = "card", className = "" }) {
    const productId = product?._id ? String(product._id) : "";
    const { store = "" } = useParams() || {};
    const [active, setActive] = useState(false);
    const [enabled, setEnabled] = useState(true);
    const [busy, setBusy] = useState(false);

    const sync = useCallback(() => {
        setActive(readWishlistIds().has(productId));
        setEnabled(isWishlistEnabled());
    }, [productId]);

    useEffect(() => {
        sync();
        window.addEventListener("wishlist-updated", sync);
        window.addEventListener("features-updated", sync);
        return () => {
            window.removeEventListener("wishlist-updated", sync);
            window.removeEventListener("features-updated", sync);
        };
    }, [sync]);

    const onClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!productId || busy) return;
        setBusy(true);

        const ids = readWishlistIds();
        const willAdd = !ids.has(productId);
        if (willAdd) ids.add(productId);
        else ids.delete(productId);
        writeWishlistIds(ids); // optimistic — dispatches wishlist-updated

        try {
            const mw = minWeight(product.weights);
            const res = await toggleWishlist({
                productId,
                productName: product.firstName || product.name || "",
                productImage:
                    product.cover_image ||
                    (product.weights && product.weights[0]?.images?.[0]) ||
                    "",
                category: product.category?.category_name || "",
                price: mw?.price || 0,
                discountPercent: mw?.discountPercent || 0,
            }, store);
            // Reconcile with the server's authoritative answer.
            if (res?.success) {
                const next = readWishlistIds();
                if (res.added) next.add(productId);
                else next.delete(productId);
                writeWishlistIds(next);
            } else {
                throw new Error("toggle failed");
            }
        } catch {
            // Revert the optimistic change.
            const revert = readWishlistIds();
            if (willAdd) revert.delete(productId);
            else revert.add(productId);
            writeWishlistIds(revert);
        } finally {
            setBusy(false);
        }
    };

    if (!enabled) return null;

    if (variant === "detail") {
        return (
            <button
                type="button"
                onClick={onClick}
                disabled={busy}
                aria-pressed={active}
                aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border font-medium transition-colors ${
                    active
                        ? "border-rose-200 bg-rose-50 text-rose-600"
                        : "border-gray-200 text-gray-700 hover:border-rose-200 hover:text-rose-600"
                } ${className}`}
            >
                <FiHeart className={`w-5 h-5 ${active ? "fill-rose-500 text-rose-500" : ""}`} />
                {active ? "Saved" : "Save"}
            </button>
        );
    }

    // Default: floating circular heart for product cards.
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            aria-pressed={active}
            aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
            className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 backdrop-blur-sm shadow-sm hover:bg-white transition-colors ${className}`}
        >
            <FiHeart
                className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-colors ${
                    active ? "fill-rose-500 text-rose-500" : "text-gray-600"
                }`}
            />
        </button>
    );
}
