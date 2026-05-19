"use client";

export default function ProductCardSkeleton({ compact = false }) {
    return (
        <div className="bg-white rounded-lg overflow-hidden shadow-sm">
            <div className="relative aspect-square bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />
            <div className={`flex flex-col items-center ${compact ? "p-2 sm:p-3" : "p-3"}`}>
                <div className="h-3 sm:h-3.5 bg-gray-200 rounded w-3/4 animate-pulse" />
                <div className="h-2.5 bg-gray-200 rounded w-1/2 mt-2 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-2/5 mt-2 animate-pulse" />
                <div className="h-4 bg-gray-200 rounded w-1/3 mt-3 animate-pulse" />
            </div>
        </div>
    );
}

export function ProductGridSkeleton({ count = 10, columns = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", compact = true }) {
    return (
        <div className={`grid ${columns} gap-3 sm:gap-4 max-w-7xl mx-auto`}>
            {Array.from({ length: count }).map((_, i) => (
                <ProductCardSkeleton key={i} compact={compact} />
            ))}
        </div>
    );
}
