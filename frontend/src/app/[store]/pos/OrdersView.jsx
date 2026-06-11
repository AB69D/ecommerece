"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
    FiSearch, FiRefreshCw, FiClock, FiShoppingBag, FiGlobe, FiPhone,
    FiAlertCircle, FiCheckCircle, FiPackage,
} from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getPosOrders, updatePosOrderStatus } from "@/services/pos";

const STATUS_OPTIONS = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const STATUS_STYLES = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    processing: "bg-purple-100 text-purple-700 border-purple-200",
    shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
    delivered: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
};

const FILTERS = ["all", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// `canChange` controls whether the status dropdown is interactive. Salesman and
// admin both have it; anyone with only order:read sees a static badge.
export default function OrdersView({ canChange = false }) {
    const { symbol } = useCurrency();
    const money = (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [savingId, setSavingId] = useState(null);
    const [toast, setToast] = useState(null);

    const flash = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3500);
    };

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLoading(true);
        try {
            const res = await getPosOrders({
                limit: 100,
                status: statusFilter !== "all" ? statusFilter : undefined,
            });
            if (res?.success) setOrders(res.data || []);
            else flash("error", res?.message || "Could not load orders");
        } catch {
            flash("error", "Could not load orders");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [statusFilter]);

    useEffect(() => { load(); }, [load]);

    const changeStatus = async (order, newStatus) => {
        if (newStatus === order.orderStatus) return;
        setSavingId(order.orderId);
        try {
            const res = await updatePosOrderStatus(order.orderId, newStatus);
            if (res?.success) {
                setOrders((prev) =>
                    prev.map((o) => (o.orderId === order.orderId ? { ...o, orderStatus: newStatus } : o)),
                );
                flash("success", `Order ${order.orderId} → ${newStatus}`);
            } else {
                flash("error", res?.message || "Status update failed");
            }
        } catch {
            flash("error", "Status update failed");
        } finally {
            setSavingId(null);
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return orders;
        return orders.filter(
            (o) =>
                o.orderId?.toLowerCase().includes(q) ||
                o.customerName?.toLowerCase().includes(q) ||
                o.customerPhone?.includes(search.trim()),
        );
    }, [orders, search]);

    return (
        <div className="h-full overflow-y-auto bg-slate-100">
            <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold text-slate-800">Orders</h2>
                    <button
                        onClick={() => load(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium disabled:opacity-60 shrink-0"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                </div>

                {toast && (
                    <div className={`p-3 rounded-xl flex items-center gap-2 text-sm border ${toast.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        {toast.type === "error" ? <FiAlertCircle className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
                        {toast.text}
                    </div>
                )}

                {/* Search */}
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by order ID, name or phone…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                </div>

                {/* Status filter chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                    {FILTERS.map((f) => (
                        <button
                            key={f}
                            onClick={() => setStatusFilter(f)}
                            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border capitalize transition-colors ${
                                statusFilter === f
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="h-48 flex items-center justify-center">
                        <div className="w-9 h-9 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200">
                        <FiPackage className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm">No orders found</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {filtered.map((o) => {
                            const isPos = o.source === "pos";
                            const saving = savingId === o.orderId;
                            return (
                                <div key={o.orderId} className="bg-white rounded-2xl border border-slate-200 p-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm font-bold text-teal-700">{o.orderId}</span>
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${isPos ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-sky-100 text-sky-700 border-sky-200"}`}>
                                                    {isPos ? <FiShoppingBag className="w-2.5 h-2.5" /> : <FiGlobe className="w-2.5 h-2.5" />}
                                                    {isPos ? "POS" : "Online"}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-700 mt-1 truncate">{o.customerName || "Walk-in customer"}</p>
                                            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                                <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {fmtDate(o.createdAt)}</span>
                                                {o.customerPhone && <span className="flex items-center gap-1"><FiPhone className="w-3 h-3" /> {o.customerPhone}</span>}
                                            </p>
                                        </div>
                                        <span className="font-bold text-slate-900 shrink-0">{money(o.totalAmount)}</span>
                                    </div>

                                    <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize ${STATUS_STYLES[o.orderStatus] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                                            {o.orderStatus}
                                        </span>
                                        {canChange ? (
                                            <div className="flex items-center gap-2">
                                                {saving && <div className="w-4 h-4 border-2 border-slate-300 border-t-teal-500 rounded-full animate-spin" />}
                                                <select
                                                    value={o.orderStatus}
                                                    disabled={saving}
                                                    onChange={(e) => changeStatus(o, e.target.value)}
                                                    className="text-sm rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60 capitalize"
                                                >
                                                    {STATUS_OPTIONS.map((s) => (
                                                        <option key={s} value={s} className="capitalize">{s}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
