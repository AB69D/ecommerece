"use client";
import { useEffect, useState } from "react";
import { subscribeRating } from "@/lib/ratings.js";
import StarRating from "./StarRating.jsx";

// Compact star summary shown on product cards. Always renders 5 stars so every
// card communicates quality at a glance; shows "New" until the first review.
export default function ProductRating({ productId, className = "", size = "sm" }) {
    const [summary, setSummary] = useState(null);

    useEffect(() => {
        if (!productId) return undefined;
        const unsub = subscribeRating(productId, setSummary);
        return unsub;
    }, [productId]);

    const count = summary?.count || 0;
    const average = summary?.average || 0;

    return (
        <div className={`flex items-center justify-center gap-1 ${className}`}>
            <StarRating value={count > 0 ? average : 0} size={size} />
            {count > 0 ? (
                <span className="text-[10px] sm:text-xs text-gray-500">
                    {average.toFixed(1)} ({count})
                </span>
            ) : (
                <span className="text-[10px] sm:text-xs text-gray-400">New</span>
            )}
        </div>
    );
}
