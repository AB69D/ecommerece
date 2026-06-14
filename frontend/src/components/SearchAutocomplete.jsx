"use client";
import { useState, useRef, useEffect } from "react";
import { useStorePush } from "@/components/StoreLink";
import { useParams } from "next/navigation";
import { FiSearch, FiX } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { suggestProducts } from "@/services/product";

// Lowest discounted variant price — the "from" price shown on a suggestion row.
const fromPrice = (weights) => {
    if (!weights || weights.length === 0) return null;
    return weights.reduce((lo, w) => {
        const p = (w.price || 0) - ((w.price || 0) * (w.discountPercent || 0)) / 100;
        return p < lo ? p : lo;
    }, Infinity);
};

// Self-contained storefront search box with live autocomplete. Owns its own
// query state; all fetching is debounced inside the change handler (never in an
// effect) and guarded against out-of-order responses. Enter (or the submit
// button) goes to the full /search page; picking a suggestion opens that
// product. `onNavigate` lets the host close its drawer/overlay on navigation.
export default function SearchAutocomplete({ onNavigate, autoFocus = false }) {
    const goTo = useStorePush();
    const { symbol } = useCurrency();
    const { store = "" } = useParams() || {};

    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    const boxRef = useRef(null);
    const debounceRef = useRef(null);
    const reqRef = useRef(0); // newest-request id, to drop stale responses

    // Close the dropdown on outside click / Escape. Listeners only — no
    // synchronous state updates in the effect body.
    useEffect(() => {
        const onPointer = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    // Drop any pending debounce on unmount.
    useEffect(() => () => clearTimeout(debounceRef.current), []);

    const runSuggest = (value) => {
        const q = value.trim();
        clearTimeout(debounceRef.current);
        if (q.length < 2) {
            setResults([]);
            setLoading(false);
            setOpen(false);
            return;
        }
        setLoading(true);
        setOpen(true);
        const reqId = ++reqRef.current;
        debounceRef.current = setTimeout(() => {
            suggestProducts({ q, limit: 6 }, store)
                .then((data) => {
                    if (reqId !== reqRef.current) return; // a newer keystroke won
                    setResults((data && data.success && data.data) || []);
                    setActiveIndex(-1);
                })
                .catch(() => {
                    if (reqId === reqRef.current) setResults([]);
                })
                .finally(() => {
                    if (reqId === reqRef.current) setLoading(false);
                });
        }, 220);
    };

    const onChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        runSuggest(value);
    };

    const reset = () => {
        setQuery("");
        setResults([]);
        setOpen(false);
        setActiveIndex(-1);
    };

    const goToProduct = (id) => {
        reset();
        onNavigate?.();
        goTo(`/product/${id}`);
    };

    const submitSearch = (e) => {
        e?.preventDefault();
        const q = query.trim();
        if (!q) return;
        reset();
        onNavigate?.();
        goTo(`/search?q=${encodeURIComponent(q)}`);
    };

    const onKeyDown = (e) => {
        if (!open || results.length === 0) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, -1));
        } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
            e.preventDefault();
            goToProduct(results[activeIndex]._id);
        }
    };

    const showDropdown = open && query.trim().length >= 2;

    return (
        <div ref={boxRef} className="relative">
            <form onSubmit={submitSearch} className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={onChange}
                    onKeyDown={onKeyDown}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder="Search products..."
                    autoFocus={autoFocus}
                    autoComplete="off"
                    aria-label="Search products"
                    className="w-full pl-11 pr-10 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm shadow-sm"
                />
                <button
                    type="submit"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-emerald-600"
                    aria-label="Search"
                >
                    <FiSearch className="w-5 h-5" />
                </button>
                {query && (
                    <button
                        type="button"
                        onClick={reset}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600"
                        aria-label="Clear search"
                    >
                        <FiX className="w-4 h-4" />
                    </button>
                )}
            </form>

            {showDropdown && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
                    {loading && results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">Searching…</div>
                    ) : results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-gray-400">
                            No matches for “{query.trim()}”
                        </div>
                    ) : (
                        <ul className="max-h-80 overflow-y-auto py-1">
                            {results.map((p, i) => {
                                const price = fromPrice(p.weights);
                                return (
                                    <li key={p._id}>
                                        <button
                                            type="button"
                                            onMouseEnter={() => setActiveIndex(i)}
                                            onClick={() => goToProduct(p._id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                                                activeIndex === i ? "bg-emerald-50" : "hover:bg-gray-50"
                                            }`}
                                        >
                                            <span className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                                {p.cover_image && (
                                                    <img
                                                        src={p.cover_image}
                                                        alt={p.firstName}
                                                        loading="lazy"
                                                        decoding="async"
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-gray-800 truncate">
                                                    {p.firstName}
                                                </span>
                                                {p.lastName && (
                                                    <span className="block text-xs text-gray-400 truncate">
                                                        {p.lastName}
                                                    </span>
                                                )}
                                            </span>
                                            {price != null && Number.isFinite(price) && (
                                                <span className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                                                    {symbol}
                                                    {price.toFixed(0)}
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <button
                        type="button"
                        onClick={submitSearch}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50/60 hover:bg-emerald-50 border-t border-gray-100"
                    >
                        <FiSearch className="w-4 h-4" />
                        See all results for “{query.trim()}”
                    </button>
                </div>
            )}
        </div>
    );
}
