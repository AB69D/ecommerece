"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "@/components/StoreLink";
import { FiSearch, FiX, FiChevronLeft, FiChevronRight, FiSliders } from "react-icons/fi";
import ProductCard from "./ProductCard";
import { ProductGridSkeleton } from "./ProductCardSkeleton";
import { searchProducts } from "@/services/product";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
    { value: "newest", label: "Newest" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "name", label: "Name: A–Z" },
];

const prettify = (s) =>
    String(s || "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

// Compact pagination window: 1 … 4 5 [6] 7 8 … 12
const pageWindow = (current, total) => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
    const out = [];
    let prev = 0;
    for (const p of sorted) {
        if (p - prev > 1) out.push("…");
        out.push(p);
        prev = p;
    }
    return out;
};

// Storefront browse/search surface. The URL query string is the single source
// of truth for every filter (so results are shareable, bookmarkable and the
// browser back button just works); changing a control rewrites the URL, and a
// single effect refetches whenever the URL changes.
//
// In category mode `lockedCategorySlug` pins the category (its filter is
// hidden); in search mode the text query comes from `?q=` (set by the navbar).
export default function ProductBrowser({ lockedCategorySlug = null, fallbackHeading = "" }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // ---- read current filter state from the URL ----
    const q = searchParams.get("q") || "";
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page")) || 1);
    const minPrice = searchParams.get("minPrice") || "";
    const maxPrice = searchParams.get("maxPrice") || "";
    const inStock = searchParams.get("inStock") === "true";

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Uncommitted price inputs (committed to the URL on submit/blur). When the
    // committed price in the URL changes from elsewhere (clear filters, back
    // button) we reset the inputs during render — the React-recommended
    // alternative to a sync effect, and focus-safe because nothing remounts.
    const [minInput, setMinInput] = useState(minPrice);
    const [maxInput, setMaxInput] = useState(maxPrice);
    const [committedPrice, setCommittedPrice] = useState({ min: minPrice, max: maxPrice });
    if (committedPrice.min !== minPrice || committedPrice.max !== maxPrice) {
        setCommittedPrice({ min: minPrice, max: maxPrice });
        setMinInput(minPrice);
        setMaxInput(maxPrice);
    }

    // ---- fetch whenever any committed filter changes ----
    // Stale-while-revalidate: previous results stay on screen until the new ones
    // arrive (no skeleton flash on filter changes). Every state update happens
    // inside an async callback, never synchronously in the effect body.
    useEffect(() => {
        let cancelled = false;

        const params = { sort, page, limit: PAGE_SIZE };
        if (q) params.q = q;
        if (minPrice) params.minPrice = minPrice;
        if (maxPrice) params.maxPrice = maxPrice;
        if (inStock) params.inStock = true;
        if (lockedCategorySlug) params.category = lockedCategorySlug;

        searchProducts(params)
            .then((data) => {
                if (cancelled) return;
                if (data && data.success) {
                    setResult(data);
                    setError(null);
                } else {
                    setError(data?.message || "Failed to load products.");
                }
            })
            .catch(() => {
                if (!cancelled) setError("Failed to load products. Please try again.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [q, sort, page, minPrice, maxPrice, inStock, lockedCategorySlug]);

    // Rewrite the URL with the given param changes. Any filter change (other
    // than an explicit page jump) resets to page 1. Empty/false values are
    // dropped so the URL stays clean.
    const updateParams = useCallback(
        (updates) => {
            const next = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(updates)) {
                if (value === "" || value === null || value === undefined || value === false) {
                    next.delete(key);
                } else {
                    next.set(key, String(value));
                }
            }
            if (!("page" in updates)) next.delete("page");
            const qs = next.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        },
        [router, pathname, searchParams],
    );

    const applyPrice = (e) => {
        e?.preventDefault();
        const min = minInput.trim();
        const max = maxInput.trim();
        updateParams({ minPrice: min, maxPrice: max });
    };

    const clearFilters = () => {
        // Preserve the text query / locked category; drop the rest.
        const next = new URLSearchParams();
        if (q) next.set("q", q);
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    const goToPage = (p) => {
        updateParams({ page: p > 1 ? p : "" });
        if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const data = result?.data || [];
    const totalCount = result?.totalCount || 0;
    const totalPages = result?.totalNoPage || 0;
    const bounds = result?.priceBounds || { min: 0, max: 0 };
    const hasActiveFilters = Boolean(minPrice || maxPrice || inStock || (sort && sort !== "newest"));

    const heading = lockedCategorySlug
        ? data[0]?.category?.category_name || prettify(fallbackHeading || lockedCategorySlug)
        : q
          ? `Search results for “${q}”`
          : "All products";

    return (
        <div className="w-full py-8 px-4 max-w-7xl mx-auto">
            {/* Header: title + count + sort */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">{heading}</h1>
                    {!loading && !error && (
                        <p className="text-gray-500 mt-1 text-sm">
                            {totalCount} {totalCount === 1 ? "product" : "products"} found
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <label htmlFor="sort" className="text-sm text-gray-500 hidden sm:block">
                        Sort by
                    </label>
                    <select
                        id="sort"
                        value={sort}
                        onChange={(e) => updateParams({ sort: e.target.value === "newest" ? "" : e.target.value })}
                        className="text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                        {SORT_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Filter bar: price range + in-stock + clear */}
            <div className="mb-8 flex flex-wrap items-center gap-3 p-3 sm:p-4 bg-gray-50 border border-gray-100 rounded-xl">
                <div className="flex items-center gap-1.5 text-gray-500 text-sm font-medium">
                    <FiSliders className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                </div>

                <form onSubmit={applyPrice} className="flex items-center gap-2">
                    <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={minInput}
                        onChange={(e) => setMinInput(e.target.value)}
                        onBlur={applyPrice}
                        placeholder={bounds.min ? `Min ${bounds.min}` : "Min"}
                        className="w-24 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        aria-label="Minimum price"
                    />
                    <span className="text-gray-400">–</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={maxInput}
                        onChange={(e) => setMaxInput(e.target.value)}
                        onBlur={applyPrice}
                        placeholder={bounds.max ? `Max ${bounds.max}` : "Max"}
                        className="w-24 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        aria-label="Maximum price"
                    />
                    <button type="submit" className="sr-only">
                        Apply price
                    </button>
                </form>

                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={inStock}
                        onChange={(e) => updateParams({ inStock: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    In stock only
                </label>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="ml-auto flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                    >
                        <FiX className="w-4 h-4" />
                        Clear filters
                    </button>
                )}
            </div>

            {/* Body */}
            {loading ? (
                <ProductGridSkeleton count={PAGE_SIZE} columns="grid-cols-2 md:grid-cols-3 lg:grid-cols-4" />
            ) : error ? (
                <div className="text-center py-16">
                    <p className="text-red-500">{error}</p>
                </div>
            ) : data.length === 0 ? (
                <div className="text-center py-16">
                    <div className="mx-auto w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <FiSearch className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-gray-600 text-lg font-medium">No products found</p>
                    <p className="text-gray-400 mt-1 text-sm">
                        {hasActiveFilters ? "Try adjusting or clearing your filters." : "Try a different search."}
                    </p>
                    {hasActiveFilters ? (
                        <button
                            onClick={clearFilters}
                            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                            <FiX className="w-4 h-4" />
                            Clear filters
                        </button>
                    ) : (
                        <Link
                            href="/"
                            className="mt-5 inline-block text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                            Continue shopping
                        </Link>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 fade-in-stagger">
                        {data.map((product) => (
                            <ProductCard key={product._id} product={product} showCategory={!lockedCategorySlug} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
                            <button
                                onClick={() => goToPage(page - 1)}
                                disabled={page <= 1}
                                className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Previous page"
                            >
                                <FiChevronLeft className="w-4 h-4" />
                            </button>

                            {pageWindow(page, totalPages).map((p, i) =>
                                p === "…" ? (
                                    <span key={`gap-${i}`} className="px-2 text-gray-400">
                                        …
                                    </span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => goToPage(p)}
                                        aria-current={p === page ? "page" : undefined}
                                        className={`min-w-9 h-9 px-3 rounded-lg text-sm font-medium border transition-colors ${
                                            p === page
                                                ? "bg-emerald-600 border-emerald-600 text-white"
                                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ),
                            )}

                            <button
                                onClick={() => goToPage(page + 1)}
                                disabled={page >= totalPages}
                                className="flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Next page"
                            >
                                <FiChevronRight className="w-4 h-4" />
                            </button>
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}
