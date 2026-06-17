"use client";
import { useEffect, useState, useCallback } from "react";
import Link, { useStorePush } from "@/components/StoreLink";
import { useParams } from "next/navigation";
import { FiPackage, FiRefreshCw, FiShoppingBag, FiRotateCcw, FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import AccountShell from "@/components/account/AccountShell";
import { useMoney } from "@/context/CurrencyContext";
import { customerFetch } from "@/services/api";
import { addToCart } from "@/utils/cart";

const STATUS_STYLES = {
    pending: "bg-amber-50 text-amber-700 ring-amber-200",
    confirmed: "bg-blue-50 text-blue-700 ring-blue-200",
    processing: "bg-indigo-50 text-indigo-700 ring-indigo-200",
    shipped: "bg-sky-50 text-sky-700 ring-sky-200",
    delivered: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-200",
    return_requested: "bg-amber-50 text-amber-700 ring-amber-200",
    returned: "bg-gray-100 text-gray-600 ring-gray-200",
};

const RETURN_REASONS = [
    { value: "defective", label: "Defective / Damaged" },
    { value: "wrong_item", label: "Wrong item received" },
    { value: "not_as_described", label: "Not as described" },
    { value: "changed_mind", label: "Changed my mind" },
    { value: "other", label: "Other" },
];

const prettyStatus = (s) => String(s || "pending").replace(/_/g, " ");
const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

const isReturnEligible = (order) => {
    if (order.orderStatus !== "delivered") return false;
    if (!order.returnAvailableUntil) return false;
    return new Date(order.returnAvailableUntil) > new Date();
};

// Empty initial state for the return form per order
const emptyReturnForm = () => ({ reason: "", description: "" });

function OrdersInner() {
    const money = useMoney();
    const goTo = useStorePush();
    const { store = "" } = useParams() || {};
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reordering, setReordering] = useState("");

    // Return request state: keyed by orderId
    const [returnForms, setReturnForms] = useState({}); // { [orderId]: { reason, description } | null }
    const [returnSubmitting, setReturnSubmitting] = useState(""); // orderId being submitted
    const [returnMsg, setReturnMsg] = useState({}); // { [orderId]: { type: 'success'|'error', text } }

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await customerFetch("/api/client/auth/orders");
            const data = await res.json();
            if (data.success) setOrders(Array.isArray(data.data) ? data.data : []);
            else setError(data.message || "Could not load your orders.");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const reorder = async (order) => {
        setReordering(order._id || order.orderId);
        try {
            for (const item of order.items || []) {
                // eslint-disable-next-line no-await-in-loop
                await addToCart(item.productId, item.quantity, item.weight, item.weightIndex || 0, item.price, 0, store);
            }
            if (typeof window !== "undefined") window.dispatchEvent(new Event("cart-updated"));
            goTo("/cart");
        } finally {
            setReordering("");
        }
    };

    const openReturnForm = (orderId) => {
        setReturnForms((prev) => ({ ...prev, [orderId]: emptyReturnForm() }));
        setReturnMsg((prev) => ({ ...prev, [orderId]: null }));
    };

    const closeReturnForm = (orderId) => {
        setReturnForms((prev) => { const next = { ...prev }; delete next[orderId]; return next; });
    };

    const updateReturnForm = (orderId, field, value) => {
        setReturnForms((prev) => ({
            ...prev,
            [orderId]: { ...prev[orderId], [field]: value },
        }));
    };

    const submitReturn = async (orderId) => {
        const form = returnForms[orderId];
        if (!form?.reason) {
            setReturnMsg((prev) => ({ ...prev, [orderId]: { type: "error", text: "Please select a reason." } }));
            return;
        }

        setReturnSubmitting(orderId);
        setReturnMsg((prev) => ({ ...prev, [orderId]: null }));
        try {
            const res = await customerFetch(`/api/client/order/${orderId}/return-request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: form.reason, description: form.description }),
            });
            const data = await res.json();
            if (data.success) {
                // Update the local order status so the badge reflects the change immediately.
                setOrders((prev) =>
                    prev.map((o) =>
                        o.orderId === orderId ? { ...o, orderStatus: "return_requested" } : o
                    )
                );
                closeReturnForm(orderId);
                setReturnMsg((prev) => ({
                    ...prev,
                    [orderId]: { type: "success", text: "Return request submitted. We will review it and get back to you." },
                }));
            } else {
                setReturnMsg((prev) => ({
                    ...prev,
                    [orderId]: { type: "error", text: data.message || "Could not submit return request." },
                }));
            }
        } catch {
            setReturnMsg((prev) => ({
                ...prev,
                [orderId]: { type: "error", text: "Network error. Please try again." },
            }));
        } finally {
            setReturnSubmitting("");
        }
    };

    if (loading) {
        return (
            <div className="py-16 flex justify-center">
                <div className="w-7 h-7 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-8 text-center">
                <p className="text-sm text-rose-600">{error}</p>
                <button onClick={load} className="mt-4 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors">
                    Try again
                </button>
            </div>
        );
    }

    if (!orders.length) {
        return (
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-10 text-center">
                <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                    <FiShoppingBag className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="mt-4 font-semibold text-gray-900">No orders yet</h3>
                <p className="text-sm text-gray-500 mt-1">When you place an order it will show up here.</p>
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-colors"
                >
                    Start shopping
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {orders.map((order) => {
                const eligible = isReturnEligible(order);
                const formOpen = !!returnForms[order.orderId];
                const msg = returnMsg[order.orderId];

                return (
                    <div key={order._id || order.orderId} className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-50 bg-gray-50/50">
                            <div className="flex items-center gap-2.5">
                                <span className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                                    <FiPackage className="w-4 h-4" />
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-gray-900">{order.orderId}</p>
                                    <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                                </div>
                            </div>
                            <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ring-1 ${
                                    STATUS_STYLES[order.orderStatus] || STATUS_STYLES.pending
                                }`}
                            >
                                {prettyStatus(order.orderStatus)}
                            </span>
                        </div>

                        <div className="px-5 py-4 space-y-3">
                            {(order.items || []).map((item, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={item.productImage || "/logo.png"}
                                        alt={item.productName}
                                        className="w-12 h-12 rounded-lg object-cover bg-gray-50 ring-1 ring-gray-100"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.productName}</p>
                                        <p className="text-xs text-gray-500">
                                            {item.weight ? `${item.weight} · ` : ""}Qty {item.quantity}
                                        </p>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-700">{money(item.totalPrice)}</p>
                                </div>
                            ))}
                        </div>

                        {/* Return request form (inline, shown when user clicks Request Return) */}
                        {formOpen && (
                            <div className="px-5 pb-4 border-t border-amber-100 bg-amber-50/40">
                                <p className="text-sm font-semibold text-gray-800 mt-4 mb-3 flex items-center gap-2">
                                    <FiRotateCcw className="w-4 h-4 text-amber-600" />
                                    Request a Return
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Reason <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            value={returnForms[order.orderId]?.reason || ""}
                                            onChange={(e) => updateReturnForm(order.orderId, "reason", e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 bg-white"
                                        >
                                            <option value="">Select a reason…</option>
                                            {RETURN_REASONS.map((r) => (
                                                <option key={r.value} value={r.value}>{r.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">
                                            Additional details (optional)
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={returnForms[order.orderId]?.description || ""}
                                            onChange={(e) => updateReturnForm(order.orderId, "description", e.target.value)}
                                            placeholder="Describe the issue…"
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
                                        />
                                    </div>
                                    {msg && (
                                        <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${msg.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                            {msg.type === "error"
                                                ? <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                                : <FiCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                                            {msg.text}
                                        </div>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            onClick={() => closeReturnForm(order.orderId)}
                                            disabled={returnSubmitting === order.orderId}
                                            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => submitReturn(order.orderId)}
                                            disabled={returnSubmitting === order.orderId}
                                            className="flex-1 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-xl font-medium transition-colors"
                                        >
                                            {returnSubmitting === order.orderId ? "Submitting…" : "Submit Return"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Per-order success message (shown after form closes) */}
                        {!formOpen && msg && (
                            <div className={`mx-5 mb-3 flex items-start gap-2 text-xs rounded-lg px-3 py-2 ${msg.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                                {msg.type === "error"
                                    ? <FiAlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                    : <FiCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                                {msg.text}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-50">
                            <div className="text-sm">
                                <span className="text-gray-500">Total</span>{" "}
                                <span className="font-bold text-gray-900">{money(order.totalAmount)}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                {/* Show "Request Return" only for eligible delivered orders where form isn't open */}
                                {eligible && !formOpen && order.orderStatus === "delivered" && (
                                    <button
                                        onClick={() => openReturnForm(order.orderId)}
                                        className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 hover:bg-amber-50 text-sm font-medium rounded-xl transition-colors"
                                    >
                                        <FiRotateCcw className="w-4 h-4" />
                                        Request Return
                                    </button>
                                )}
                                <button
                                    onClick={() => reorder(order)}
                                    disabled={reordering === (order._id || order.orderId)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-xl transition-colors"
                                >
                                    <FiRefreshCw className={`w-4 h-4 ${reordering === (order._id || order.orderId) ? "animate-spin" : ""}`} />
                                    {reordering === (order._id || order.orderId) ? "Adding…" : "Re-order"}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

export default function AccountOrdersPage() {
    return (
        <AccountShell title="My Orders" subtitle="Your order history and quick re-ordering">
            <OrdersInner />
        </AccountShell>
    );
}
