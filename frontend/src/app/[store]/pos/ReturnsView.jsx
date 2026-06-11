"use client";
import { useState, useEffect, useCallback } from "react";
import { FiSearch, FiRotateCcw, FiPackage, FiClock, FiUser, FiAlertTriangle } from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getPosSales, returnPosSale } from "@/services/pos";

const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function ReturnsView({ notify }) {
    const { symbol } = useCurrency();
    const money = (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [confirmId, setConfirmId] = useState(null);
    const [busyId, setBusyId] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPosSales({ search: debounced, limit: 40 });
            if (res?.success) setSales(res.data || []);
        } catch {
            notify("error", "Failed to load sales");
        } finally {
            setLoading(false);
        }
    }, [debounced, notify]);

    useEffect(() => { load(); }, [load]);

    const doReturn = async (orderId) => {
        setBusyId(orderId);
        try {
            const res = await returnPosSale(orderId);
            if (res?.success) {
                notify("success", `Returned ${orderId} · stock restored`);
                setSales((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, orderStatus: "returned" } : o)));
            } else {
                notify("error", res?.message || "Return failed");
            }
        } catch {
            notify("error", "Network error processing return");
        } finally {
            setBusyId(null);
            setConfirmId(null);
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-100">
            <div className="max-w-3xl mx-auto p-3 sm:p-5 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-1">
                        <FiRotateCcw className="w-5 h-5 text-teal-500" /> Process a return
                    </h2>
                    <p className="text-xs text-slate-500 mb-3">Find the original POS sale and return it — the items go back into stock.</p>
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by order ID, customer or phone…"
                            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="h-40 flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
                    </div>
                ) : sales.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                        <FiPackage className="w-12 h-12 mx-auto mb-3" />
                        <p className="text-sm">No POS sales found</p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {sales.map((o) => {
                            const returned = o.orderStatus === "returned";
                            return (
                                <div key={o._id} className="bg-white rounded-2xl border border-slate-200 p-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-sm font-semibold text-teal-700">{o.orderId}</span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${o.saleType === "wholesale" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                                    {o.saleType || "retail"}
                                                </span>
                                                {returned && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">Returned</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                                <span className="flex items-center gap-1"><FiUser className="w-3 h-3" /> {o.customerName}</span>
                                                <span className="flex items-center gap-1"><FiClock className="w-3 h-3" /> {fmtDate(o.createdAt)}</span>
                                                <span>{o.items?.length || 0} item(s)</span>
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-bold text-slate-900">{money(o.totalAmount)}</p>
                                            {!returned && (
                                                confirmId === o.orderId ? (
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        <button
                                                            onClick={() => doReturn(o.orderId)}
                                                            disabled={busyId === o.orderId}
                                                            className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-medium disabled:opacity-60"
                                                        >
                                                            {busyId === o.orderId ? "…" : "Confirm"}
                                                        </button>
                                                        <button onClick={() => setConfirmId(null)} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium">Cancel</button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmId(o.orderId)}
                                                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium"
                                                    >
                                                        <FiRotateCcw className="w-3 h-3" /> Return
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                    {confirmId === o.orderId && (
                                        <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                            <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" /> This restocks all items and marks the sale refunded.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
