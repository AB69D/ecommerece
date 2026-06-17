"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { FiCreditCard, FiCheck, FiRefreshCw, FiPackage, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { authFetch } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useMoney } from "@/context/CurrencyContext.jsx";

const COURIER_LABELS = { pathao: "Pathao", steadfast: "Steadfast" };
const COURIER_COLORS = { pathao: "#e11d48", steadfast: "#0ea5e9" };

const STATUS_LABELS = {
    shipped: "Shipped",
    delivered: "Delivered",
};

function CourierSummaryCard({ courier, data, money, onMarkRemitted, canWrite, marking }) {
    const [expanded, setExpanded] = useState(false);
    const color = COURIER_COLORS[courier] || "#6366f1";
    const label = COURIER_LABELS[courier] || courier;
    const orders = data?.orders || [];
    const totalCOD = data?.totalCOD || 0;
    const orderCount = data?.orderCount || 0;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: color }}
                        >
                            {label.charAt(0)}
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">{label}</p>
                            <p className="text-xs text-gray-400">{orderCount} orders pending remittance</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-xl font-bold text-gray-800">{money(totalCOD)}</p>
                        <p className="text-xs text-gray-400">pending COD</p>
                    </div>
                </div>

                {orderCount > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                        {canWrite && (
                            <button
                                onClick={() => onMarkRemitted(courier)}
                                disabled={marking}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {marking ? (
                                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <FiCheck className="w-3.5 h-3.5" />
                                )}
                                Mark all remitted
                            </button>
                        )}
                        <button
                            onClick={() => setExpanded((v) => !v)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            {expanded ? <FiChevronUp className="w-3.5 h-3.5" /> : <FiChevronDown className="w-3.5 h-3.5" />}
                            {expanded ? "Hide orders" : `Show ${orderCount} orders`}
                        </button>
                    </div>
                )}
            </div>

            {expanded && orders.length > 0 && (
                <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="text-left font-semibold px-4 py-3">Order ID</th>
                                <th className="text-left font-semibold px-4 py-3">Customer</th>
                                <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Dispatched</th>
                                <th className="text-left font-semibold px-4 py-3">Status</th>
                                <th className="text-right font-semibold px-4 py-3">COD Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((o) => (
                                <tr key={o._id || o.orderId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-xs font-medium text-indigo-700 whitespace-nowrap">
                                        {o.orderId}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-700 truncate max-w-[140px]">{o.customerName}</div>
                                        <div className="text-[11px] text-gray-400">{o.customerPhone}</div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap hidden sm:table-cell">
                                        {o.courierDispatchedAt
                                            ? new Date(o.courierDispatchedAt).toLocaleDateString("en-GB")
                                            : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${
                                            o.orderStatus === "delivered"
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-indigo-50 text-indigo-700"
                                        }`}>
                                            {STATUS_LABELS[o.orderStatus] || o.orderStatus}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">
                                        {money(o.totalAmount)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {orderCount === 0 && (
                <div className="px-5 pb-5 text-sm text-gray-400">
                    No unremitted COD orders for {label}.
                </div>
            )}
        </div>
    );
}

export default function RemittancePage() {
    const { store } = useParams() || {};
    const { can } = useAdminAuth();
    const money = useMoney();
    const canWrite = can("order:write");

    const [data, setData] = useState(null);
    const [steadfastBalance, setSteadfastBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [marking, setMarking] = useState({ pathao: false, steadfast: false });
    const [msg, setMsg] = useState({ type: "", text: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const r = await authFetch("/api/v1/admin/courier/remittance-orders");
            const d = await r.json();
            if (d?.success) {
                setData(d.data);
            } else {
                setMsg({ type: "error", text: d?.message || "Failed to load remittance data." });
            }
        } catch {
            setMsg({ type: "error", text: "Failed to load remittance data." });
        } finally {
            setLoading(false);
        }
    }, []);

    const loadSteadfastBalance = useCallback(async () => {
        try {
            const r = await authFetch("/api/v1/admin/courier/steadfast-balance");
            const d = await r.json();
            if (d?.success) setSteadfastBalance(d.data);
        } catch { /* Steadfast may not be configured */ }
    }, []);

    useEffect(() => {
        load();
        loadSteadfastBalance();
    }, [load, loadSteadfastBalance]);

    const handleMarkRemitted = async (courier) => {
        setMarking((m) => ({ ...m, [courier]: true }));
        setMsg({ type: "", text: "" });
        try {
            const r = await authFetch("/api/v1/admin/courier/mark-remitted", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ courier }),
            });
            const d = await r.json();
            if (d?.success) {
                setMsg({ type: "success", text: `Marked ${d.data?.modifiedCount || 0} ${COURIER_LABELS[courier]} orders as remitted.` });
                load();
            } else {
                setMsg({ type: "error", text: d?.message || "Failed to mark orders." });
            }
        } catch {
            setMsg({ type: "error", text: "Request failed. Please try again." });
        } finally {
            setMarking((m) => ({ ...m, [courier]: false }));
        }
    };

    const totalPending =
        (data?.pathao?.totalCOD || 0) + (data?.steadfast?.totalCOD || 0);
    const totalOrders =
        (data?.pathao?.orderCount || 0) + (data?.steadfast?.orderCount || 0);

    return (
        <div className="space-y-6">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <FiCreditCard className="w-5 h-5" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">COD Remittance</h1>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Track cash-on-delivery amounts held by couriers pending bank transfer
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { load(); loadSteadfastBalance(); }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-xl transition-colors"
                >
                    <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {msg.text && (
                <div className={`text-sm rounded-xl px-4 py-3 ${
                    msg.type === "error"
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}>
                    {msg.text}
                </div>
            )}

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="w-9 h-9 border-4 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Summary bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <p className="text-xs text-gray-500">Total pending (all couriers)</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">{money(totalPending)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{totalOrders} unremitted COD orders</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <p className="text-xs text-gray-500">Pathao pending</p>
                            <p className="text-2xl font-bold text-gray-800 mt-1">{money(data?.pathao?.totalCOD || 0)}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{data?.pathao?.orderCount || 0} orders</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs text-gray-500">Steadfast pending</p>
                                    <p className="text-2xl font-bold text-gray-800 mt-1">{money(data?.steadfast?.totalCOD || 0)}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{data?.steadfast?.orderCount || 0} orders</p>
                                </div>
                                {steadfastBalance && (
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">Live API balance</p>
                                        <p className="text-sm font-bold text-sky-600">{money(steadfastBalance.current_balance || steadfastBalance.balance || 0)}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {totalOrders === 0 ? (
                        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                            <FiPackage className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-medium">No pending COD remittance</p>
                            <p className="text-sm text-gray-400 mt-1">
                                All COD orders from couriers have been marked as remitted, or no courier orders exist yet.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {["pathao", "steadfast"].map((courier) => (
                                <CourierSummaryCard
                                    key={courier}
                                    courier={courier}
                                    data={data?.[courier]}
                                    money={money}
                                    onMarkRemitted={handleMarkRemitted}
                                    canWrite={canWrite}
                                    marking={marking[courier]}
                                />
                            ))}
                        </div>
                    )}

                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                        <strong>How this works:</strong> When you receive the bank transfer from a courier, click
                        "Mark all remitted" to clear the orders from this list. For Pathao, there is no live API balance —
                        amounts shown are calculated from your own order records. Steadfast shows a live API balance when
                        credentials are configured in Settings.
                    </div>
                </>
            )}
        </div>
    );
}
