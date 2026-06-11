"use client";
import { useEffect, useState, useCallback } from "react";
import Link, { useStorePush } from "@/components/StoreLink";
import { FiPackage, FiRefreshCw, FiShoppingBag } from "react-icons/fi";
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

const prettyStatus = (s) => String(s || "pending").replace(/_/g, " ");
const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";

function OrdersInner() {
    const money = useMoney();
    const goTo = useStorePush();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reordering, setReordering] = useState("");

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
                await addToCart(item.productId, item.quantity, item.weight, item.weightIndex || 0, item.price, 0);
            }
            if (typeof window !== "undefined") window.dispatchEvent(new Event("cart-updated"));
            goTo("/cart");
        } finally {
            setReordering("");
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
            {orders.map((order) => (
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

                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-50">
                        <div className="text-sm">
                            <span className="text-gray-500">Total</span>{" "}
                            <span className="font-bold text-gray-900">{money(order.totalAmount)}</span>
                        </div>
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
            ))}
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
