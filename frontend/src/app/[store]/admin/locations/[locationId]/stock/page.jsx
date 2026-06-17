"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    FiArrowLeft, FiSearch, FiPackage, FiAlertTriangle, FiCheck,
} from "react-icons/fi";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

const ADJUST_REASONS = [
    { value: "purchase", label: "Purchase / Received" },
    { value: "adjustment", label: "Manual Adjustment" },
    { value: "return", label: "Customer Return" },
    { value: "damage", label: "Damaged / Loss" },
];

export default function LocationStockPage() {
    const { store, locationId } = useParams() || {};
    const router = useRouter();
    const { can } = useAdminAuth();
    const canWrite = can("inventory:write");

    const [location, setLocation] = useState(null);
    const [stockItems, setStockItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [message, setMessage] = useState({ text: "", ok: true });

    // Adjust stock inline state: { itemKey, delta, reason }
    const [adjusting, setAdjusting] = useState(null);
    const [adjustSaving, setAdjustSaving] = useState(false);

    const flash = (text, ok = true) => {
        setMessage({ text, ok });
        setTimeout(() => setMessage({ text: "", ok: true }), 3000);
    };

    const load = useCallback(async () => {
        if (!locationId) return;
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 20, ...(search ? { search } : {}) });
            const [locRes, stockRes] = await Promise.all([
                authFetch(`/api/v1/admin/location`),
                authFetch(`/api/v1/admin/location/${locationId}/stock?${params}`),
            ]);
            const locData = await locRes.json();
            const stockData = await stockRes.json();

            if (locData?.success) {
                const found = (locData.data || []).find((l) => l._id === locationId);
                setLocation(found || null);
            }
            if (stockData?.success) {
                setStockItems(stockData.data?.items || []);
                setTotalPages(stockData.data?.totalPages || 1);
            }
        } catch {
            /* ignore */
        } finally {
            setLoading(false);
        }
    }, [locationId, page, search]);

    useEffect(() => { load(); }, [load]);

    // Debounced search
    useEffect(() => {
        const t = setTimeout(() => { setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const handleAdjust = async (item) => {
        const delta = parseInt(adjusting?.delta || "0", 10);
        if (!delta) { flash("Enter a non-zero delta.", false); return; }
        setAdjustSaving(true);
        try {
            const res = await authFetch(`/api/v1/admin/location/${locationId}/stock`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: item.productId,
                    weightIndex: item.weightIndex,
                    delta,
                    reason: adjusting?.reason || "adjustment",
                }),
            });
            const d = await res.json();
            if (d?.success) {
                flash("Stock adjusted");
                setAdjusting(null);
                load();
            } else {
                flash(d?.message || "Could not adjust stock.", false);
            }
        } catch {
            flash("Could not adjust stock.", false);
        } finally {
            setAdjustSaving(false);
        }
    };

    const itemKey = (item) => `${item.productId}-${item.weightIndex}`;
    const isAdjusting = (item) => adjusting?.key === itemKey(item);

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => router.push(`/${store}/admin/locations`)}
                    className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                    <FiArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {location?.name || "Location"} — Stock
                    </h1>
                    {location && (
                        <p className="text-sm text-gray-500 mt-0.5">
                            {location.code} &middot; {location.type} &middot; {location.address || "No address"}
                        </p>
                    )}
                </div>
            </div>

            {message.text && (
                <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
                    message.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}>
                    {message.ok ? <FiCheck className="w-4 h-4" /> : <FiAlertTriangle className="w-4 h-4" />}
                    {message.text}
                </div>
            )}

            {/* Search */}
            <div className="relative mb-5">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search products…"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {/* Table */}
            {loading ? (
                <div className="py-16 flex justify-center">
                    <div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : stockItems.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-xl py-16 text-center">
                    <FiPackage className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No stock records at this location.</p>
                </div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                                    <th className="pb-3 pr-4">Product</th>
                                    <th className="pb-3 pr-4">SKU</th>
                                    <th className="pb-3 pr-4">Variant</th>
                                    <th className="pb-3 pr-4 text-right">Stock</th>
                                    <th className="pb-3 pr-4 text-right">Reserved</th>
                                    <th className="pb-3 pr-4 text-right">Available</th>
                                    {canWrite && <th className="pb-3">Adjust</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stockItems.map((item) => {
                                    const available = item.stock - (item.reservedQty || 0);
                                    const lowStock = available < 5;
                                    return (
                                        <tr
                                            key={itemKey(item)}
                                            className={`group transition-colors ${lowStock ? "bg-red-50 hover:bg-red-100" : "hover:bg-gray-50"}`}
                                        >
                                            <td className="py-3 pr-4">
                                                <span className="font-medium text-gray-800">{item.productName}</span>
                                            </td>
                                            <td className="py-3 pr-4">
                                                <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                                                    {item.sku || "—"}
                                                </code>
                                            </td>
                                            <td className="py-3 pr-4 text-gray-600">{item.weight || "—"}</td>
                                            <td className="py-3 pr-4 text-right font-mono text-gray-800">{item.stock}</td>
                                            <td className="py-3 pr-4 text-right font-mono text-gray-500">{item.reservedQty || 0}</td>
                                            <td className="py-3 pr-4 text-right">
                                                <span className={`font-mono font-semibold ${lowStock ? "text-red-600" : "text-gray-800"}`}>
                                                    {available}
                                                </span>
                                                {lowStock && (
                                                    <FiAlertTriangle className="w-3.5 h-3.5 text-red-500 inline ml-1" />
                                                )}
                                            </td>
                                            {canWrite && (
                                                <td className="py-3">
                                                    {isAdjusting(item) ? (
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <input
                                                                type="number"
                                                                placeholder="±qty"
                                                                value={adjusting.delta}
                                                                onChange={(e) =>
                                                                    setAdjusting((a) => ({ ...a, delta: e.target.value }))
                                                                }
                                                                className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            />
                                                            <select
                                                                value={adjusting.reason}
                                                                onChange={(e) =>
                                                                    setAdjusting((a) => ({ ...a, reason: e.target.value }))
                                                                }
                                                                className="px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
                                                            >
                                                                {ADJUST_REASONS.map((r) => (
                                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                                ))}
                                                            </select>
                                                            <button
                                                                onClick={() => handleAdjust(item)}
                                                                disabled={adjustSaving}
                                                                className="px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                                            >
                                                                {adjustSaving ? "…" : "Apply"}
                                                            </button>
                                                            <button
                                                                onClick={() => setAdjusting(null)}
                                                                className="px-2 py-1 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50"
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() =>
                                                                setAdjusting({
                                                                    key: itemKey(item),
                                                                    delta: "",
                                                                    reason: "adjustment",
                                                                })
                                                            }
                                                            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2 py-1 hover:bg-indigo-50 rounded-lg"
                                                        >
                                                            Adjust
                                                        </button>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-5">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Prev
                            </button>
                            <span className="text-sm text-gray-500">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
