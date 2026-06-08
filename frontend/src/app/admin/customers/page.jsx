"use client";
import { useState, useEffect, useCallback } from "react";
import { FiUsers, FiUserX, FiSearch, FiPhone, FiMail, FiShoppingBag, FiMapPin, FiClock } from "react-icons/fi";
import { getOrderedCustomers, getAbandonedCheckouts, getCustomerStats } from "@/services/customers";
import { useCurrency } from "@/context/CurrencyContext.jsx";

const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

export default function AdminCustomersPage() {
    const { symbol } = useCurrency();
    const [tab, setTab] = useState("ordered"); // 'ordered' | 'abandoned'
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [ordered, setOrdered] = useState([]);
    const [abandoned, setAbandoned] = useState([]);
    const [stats, setStats] = useState({ orderedCustomers: 0, abandonedCheckouts: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search.trim()), 350);
        return () => clearTimeout(t);
    }, [search]);

    const loadStats = useCallback(async () => {
        try {
            setStats(await getCustomerStats());
        } catch {
            // non-critical
        }
    }, []);

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (tab === "ordered") {
                setOrdered(await getOrderedCustomers(debounced));
            } else {
                setAbandoned(await getAbandonedCheckouts(debounced));
            }
        } catch (err) {
            setError(err.message || "Failed to load");
        } finally {
            setLoading(false);
        }
    }, [tab, debounced]);

    useEffect(() => { loadStats(); }, [loadStats]);
    useEffect(() => { loadData(); }, [loadData]);

    const tabs = [
        { key: "ordered", label: "Customers", icon: FiUsers, count: stats.orderedCustomers },
        { key: "abandoned", label: "Abandoned Checkouts", icon: FiUserX, count: stats.abandonedCheckouts },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-bold text-gray-800">Customers</h3>
                <p className="text-gray-500 mt-1">
                    People who ordered, and visitors who started checkout but didn&apos;t finish.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-gray-200">
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 font-medium text-sm transition-colors ${
                                active
                                    ? "border-indigo-600 text-indigo-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700"
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>
                                {t.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name, phone or email"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-9 h-9 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : error ? (
                <p className="text-red-500 text-sm">{error}</p>
            ) : tab === "ordered" ? (
                <OrderedTable rows={ordered} symbol={symbol} />
            ) : (
                <AbandonedTable rows={abandoned} symbol={symbol} />
            )}
        </div>
    );
}

function OrderedTable({ rows, symbol }) {
    if (rows.length === 0) {
        return <EmptyState icon={FiUsers} text="No customers yet" />;
    }
    return (
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Contact</th>
                        <th className="px-4 py-3 font-medium text-center">Orders</th>
                        <th className="px-4 py-3 font-medium text-right">Total Spent</th>
                        <th className="px-4 py-3 font-medium">Last Order</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((c) => (
                        <tr key={c.phone} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold flex-shrink-0">
                                        {(c.name || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{c.name}</p>
                                        {c.address && (
                                            <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                                                <FiMapPin className="w-3 h-3" /> {c.address}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                                <p className="flex items-center gap-1"><FiPhone className="w-3 h-3 text-gray-400" /> {c.phone}</p>
                                {c.email && <p className="flex items-center gap-1 text-xs text-gray-400"><FiMail className="w-3 h-3" /> {c.email}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center gap-1 font-medium text-gray-800">
                                    <FiShoppingBag className="w-3.5 h-3.5 text-gray-400" /> {c.totalOrders}
                                </span>
                                {c.deliveredOrders > 0 && (
                                    <p className="text-[11px] text-emerald-600">{c.deliveredOrders} delivered</p>
                                )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                {symbol}{c.totalSpent}
                            </td>
                            <td className="px-4 py-3 text-gray-500">{formatDate(c.lastOrderDate)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AbandonedTable({ rows, symbol }) {
    if (rows.length === 0) {
        return <EmptyState icon={FiUserX} text="No abandoned checkouts" />;
    }
    return (
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
                <thead>
                    <tr className="bg-gray-50 text-left text-gray-500 text-xs uppercase tracking-wider">
                        <th className="px-4 py-3 font-medium">Customer</th>
                        <th className="px-4 py-3 font-medium">Contact</th>
                        <th className="px-4 py-3 font-medium text-center">Cart</th>
                        <th className="px-4 py-3 font-medium text-right">Cart Value</th>
                        <th className="px-4 py-3 font-medium">Last Activity</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((l) => (
                        <tr key={l._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-semibold flex-shrink-0">
                                        {(l.customerName || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-medium text-gray-800 truncate">{l.customerName || "Unknown"}</p>
                                        {l.shippingAddress && (
                                            <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                                                <FiMapPin className="w-3 h-3" /> {l.shippingAddress}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                                {l.customerPhone ? (
                                    <p className="flex items-center gap-1"><FiPhone className="w-3 h-3 text-gray-400" /> {l.customerPhone}</p>
                                ) : (
                                    <span className="text-gray-300">No phone</span>
                                )}
                                {l.customerEmail && <p className="flex items-center gap-1 text-xs text-gray-400"><FiMail className="w-3 h-3" /> {l.customerEmail}</p>}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                                {l.itemCount > 0 ? `${l.itemCount} item${l.itemCount > 1 ? "s" : ""}` : <span className="text-gray-300">Empty</span>}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                {l.cartValue > 0 ? `${symbol}${l.cartValue}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                                <span className="flex items-center gap-1"><FiClock className="w-3 h-3 text-gray-400" /> {formatDate(l.lastActivityAt)}</span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EmptyState({ icon: Icon, text }) {
    return (
        <div className="text-center py-16">
            <Icon className="w-14 h-14 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{text}</p>
        </div>
    );
}
