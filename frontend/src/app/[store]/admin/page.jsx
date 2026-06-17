"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "@/components/StoreLink";
import {
    FiDollarSign, FiShoppingCart, FiPackage, FiAlertTriangle, FiTrendingUp, FiTrendingDown,
    FiGrid, FiTruck, FiStar, FiArrowRight, FiShoppingBag, FiGlobe, FiUsers, FiCreditCard,
    FiMapPin,
} from "react-icons/fi";
import { authFetch } from "@/services/api";
import { getDashboardOverview } from "@/services/analytics";
import { AreaLineChart, BarChart, DonutChart, HBarList } from "@/components/admin/Charts";
import { useMoney } from "@/context/CurrencyContext.jsx";

const STATUS_META = {
    pending: { label: "Pending", color: "#f59e0b" },
    confirmed: { label: "Confirmed", color: "#3b82f6" },
    processing: { label: "Processing", color: "#8b5cf6" },
    shipped: { label: "Shipped", color: "#6366f1" },
    delivered: { label: "Delivered", color: "#10b981" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
    return_requested: { label: "Return req.", color: "#f97316" },
    returned: { label: "Returned", color: "#6b7280" },
    unknown: { label: "Unknown", color: "#94a3b8" },
};

const RANGES = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
];

const statusBadge = (s) => {
    const m = STATUS_META[s] || STATUS_META.unknown;
    return { label: m.label, color: m.color };
};

function StatCard({ icon, label, value, accent, growth }) {
    const up = growth >= 0;
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1 truncate">{value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
                    {icon}
                </div>
            </div>
            {growth !== undefined && growth !== null && (
                <div className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-600" : "text-red-500"}`}>
                    {up ? <FiTrendingUp className="w-3.5 h-3.5" /> : <FiTrendingDown className="w-3.5 h-3.5" />}
                    {Math.abs(growth)}% <span className="text-gray-400 font-normal">vs prev 7d</span>
                </div>
            )}
        </div>
    );
}

// ── Stock by Location widget (multiWarehouse only) ─────────────────────────
function StockByLocationWidget({ store, money }) {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch("/api/v1/admin/location");
                const d = await res.json();
                if (d?.success) {
                    setLocations(d.data || []);
                    setEnabled(true);
                }
            } catch {
                setEnabled(false);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading || !enabled || locations.length === 0) return null;

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <FiMapPin className="w-5 h-5" />
                    </span>
                    <div>
                        <h3 className="font-semibold text-gray-800">Stock by Location</h3>
                        <p className="text-xs text-gray-400">Multi-warehouse inventory overview</p>
                    </div>
                </div>
                <Link href="/admin/locations" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                    Manage <FiArrowRight className="w-4 h-4" />
                </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {locations.map((loc) => (
                    <div key={loc._id} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-semibold text-gray-800 truncate">{loc.name}</p>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize ${
                                loc.active !== false ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"
                            }`}>{loc.type}</span>
                        </div>
                        <code className="text-[11px] text-gray-400">{loc.code}</code>
                        {loc.isDefault && (
                            <span className="ml-2 text-[10px] text-indigo-600 font-semibold">DEFAULT</span>
                        )}
                        <div className="mt-2">
                            <Link
                                href={`/${store}/admin/locations/${loc._id}/stock`}
                                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                View stock
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function DashboardPage() {
    const { store } = useParams() || {};
    const [days, setDays] = useState(30);
    const [overview, setOverview] = useState(null);
    const [recentOrders, setRecentOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);
    const [remittance, setRemittance] = useState(null);
    const money = useMoney();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getDashboardOverview(days);
            if (res?.success) {
                setOverview(res.data);
                setDenied(false);
            } else {
                setDenied(true);
            }
        } catch {
            setDenied(true);
        } finally {
            setLoading(false);
        }
    }, [days]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        (async () => {
            try {
                const r = await authFetch(`/api/admin/order/get-all`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page: 1, limit: 6 }),
                });
                const d = await r.json();
                if (d?.success) setRecentOrders(d.data || []);
            } catch { /* ignore */ }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const r = await authFetch(`/api/v1/admin/courier/cod-summary`);
                const d = await r.json();
                if (d?.success && d.data) setRemittance(d.data);
            } catch { /* silent — courier may not be configured */ }
        })();
    }, []);

    const s = overview?.summary;
    const statusData = (overview?.ordersByStatus || [])
        .map((x) => ({ ...x, ...statusBadge(x.status) }))
        .filter((x) => x.count > 0)
        .map((x) => ({ label: x.label, value: x.count, color: x.color }));

    // --- POS analytics ------------------------------------------------
    const pos = overview?.pos;
    const posChannel = pos?.channel || { ecommerce: { revenue: 0, orders: 0 }, pos: { revenue: 0, orders: 0 } };
    const posByType = pos?.byType || { retail: { revenue: 0, orders: 0 }, wholesale: { revenue: 0, orders: 0 } };
    const posSellers = pos?.sellers || [];
    const posSeries = pos?.series || [];
    const posTypeData = [
        { label: "Retail", value: posByType.retail.orders, color: "#8b5cf6" },
        { label: "Wholesale", value: posByType.wholesale.orders, color: "#f59e0b" },
    ].filter((d) => d.value > 0);
    const channelData = [
        { label: "E-commerce", value: posChannel.ecommerce.orders, color: "#0ea5e9" },
        { label: "POS", value: posChannel.pos.orders, color: "#8b5cf6" },
    ].filter((d) => d.value > 0);

    // --- Profitability (null when the profitReporting feature is off) ----
    const profit = overview?.profit || null;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Your store at a glance</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <a
                        href={`/${store}/pos`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
                    >
                        <FiShoppingBag className="w-4 h-4" /> Open POS
                    </a>
                    <a
                        href={`/${store}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl shadow-sm transition-colors"
                    >
                        <FiGlobe className="w-4 h-4" /> View Store
                    </a>
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                        {RANGES.map((r) => (
                            <button
                                key={r.value}
                                onClick={() => setDays(r.value)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${days === r.value ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <StatCard icon={<FiDollarSign className="w-5 h-5" />} label="Total revenue" value={money(s?.totalRevenue)} accent="#6366f1" growth={s?.revenueGrowth} />
                        <StatCard icon={<FiShoppingCart className="w-5 h-5" />} label="Total orders" value={s?.totalOrders ?? 0} accent="#10b981" growth={s?.ordersGrowth} />
                        <StatCard icon={<FiPackage className="w-5 h-5" />} label="Products" value={s?.totalProducts ?? 0} accent="#3b82f6" />
                        <StatCard icon={<FiAlertTriangle className="w-5 h-5" />} label="Low stock" value={s?.lowStockCount ?? 0} accent="#f59e0b" />
                    </div>

                    {denied && (
                        <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                            You don&apos;t have permission to view analytics. Showing limited data.
                        </div>
                    )}

                    {/* Charts row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="font-semibold text-gray-800">Revenue</h2>
                                <span className="text-xs text-gray-400">last {days} days</span>
                            </div>
                            <AreaLineChart data={overview?.series || []} valueKey="revenue" color="#6366f1" formatValue={money} />
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <h2 className="font-semibold text-gray-800 mb-3">Orders by status</h2>
                            <DonutChart data={statusData} />
                            <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5">
                                {statusData.map((d) => (
                                    <div key={d.label} className="flex items-center gap-2 text-xs">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                                        <span className="text-gray-600 truncate">{d.label}</span>
                                        <span className="text-gray-400 ml-auto">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-3">
                                <h2 className="font-semibold text-gray-800">Orders per day</h2>
                                <span className="text-xs text-gray-400">last {days} days</span>
                            </div>
                            <BarChart data={overview?.series || []} valueKey="orders" color="#10b981" />
                        </div>
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <FiStar className="w-4 h-4 text-amber-500" /> Top products
                            </h2>
                            <HBarList
                                data={(overview?.topProducts || []).map((p) => ({ label: p.name, value: p.qty }))}
                                color="#6366f1"
                                formatValue={(v) => `${v} sold`}
                            />
                        </div>
                    </div>

                    {/* Profitability — revenue vs cost of goods (cost snapshot at sale time) */}
                    {profit && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 pt-1">
                                <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                    <FiTrendingUp className="w-5 h-5" />
                                </span>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">Profitability</h2>
                                    <p className="text-xs text-gray-400">Revenue minus product cost captured at sale time · all time</p>
                                </div>
                                <Link href="/admin/profit" className="ml-auto text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                                    Full report <FiArrowRight className="w-4 h-4" />
                                </Link>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                <StatCard icon={<FiPackage className="w-5 h-5" />} label="Cost of goods" value={money(profit.cost)} accent="#f97316" />
                                <StatCard icon={<FiTrendingUp className="w-5 h-5" />} label="Gross profit" value={money(profit.grossProfit)} accent="#10b981" />
                                <StatCard icon={<FiDollarSign className="w-5 h-5" />} label="Net profit" value={money(profit.netProfit)} accent="#6366f1" />
                                <StatCard icon={<FiStar className="w-5 h-5" />} label="Gross margin" value={`${profit.margin}%`} accent="#8b5cf6" />
                            </div>

                            {/* Per-channel profit comparison */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {[
                                    { key: "ecommerce", label: "E-commerce", icon: <FiGlobe className="w-4 h-4" />, accent: "#0ea5e9" },
                                    { key: "pos", label: "POS", icon: <FiShoppingBag className="w-4 h-4" />, accent: "#8b5cf6" },
                                ].map((c) => {
                                    const ch = profit.channels?.[c.key] || { revenue: 0, cost: 0, profit: 0, margin: 0 };
                                    return (
                                        <div key={c.key} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="font-semibold text-gray-800">{c.label} profit</p>
                                                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${c.accent}1a`, color: c.accent }}>{c.icon}</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div>
                                                    <p className="text-[11px] text-gray-400">Revenue</p>
                                                    <p className="font-bold text-gray-800 text-sm mt-0.5">{money(ch.revenue)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] text-gray-400">Cost</p>
                                                    <p className="font-bold text-orange-600 text-sm mt-0.5">{money(ch.cost)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[11px] text-gray-400">Profit</p>
                                                    <p className="font-bold text-emerald-600 text-sm mt-0.5">{money(ch.profit)}</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400 mt-3">Gross margin <span className="font-semibold text-gray-600">{ch.margin}%</span></p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* POS analytics */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 pt-1">
                            <span className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                                <FiShoppingBag className="w-5 h-5" />
                            </span>
                            <div>
                                <h2 className="text-lg font-bold text-gray-800">Point of Sale</h2>
                                <p className="text-xs text-gray-400">In-store sales by your POS sellers</p>
                            </div>
                            <Link href="/admin/pos-sellers" className="ml-auto text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                                Manage sellers <FiArrowRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {/* Channel + type comparison cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">E-commerce sales</p>
                                    <span className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center"><FiGlobe className="w-4 h-4" /></span>
                                </div>
                                <p className="text-xl font-bold text-gray-800 mt-2">{money(posChannel.ecommerce.revenue)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{posChannel.ecommerce.orders} orders</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">POS sales</p>
                                    <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center"><FiShoppingBag className="w-4 h-4" /></span>
                                </div>
                                <p className="text-xl font-bold text-gray-800 mt-2">{money(posChannel.pos.revenue)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{posChannel.pos.orders} orders</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">POS retail</p>
                                    <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><FiShoppingCart className="w-4 h-4" /></span>
                                </div>
                                <p className="text-xl font-bold text-gray-800 mt-2">{money(posByType.retail.revenue)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{posByType.retail.orders} orders</p>
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500">POS wholesale</p>
                                    <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center"><FiPackage className="w-4 h-4" /></span>
                                </div>
                                <p className="text-xl font-bold text-gray-800 mt-2">{money(posByType.wholesale.revenue)}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{posByType.wholesale.orders} orders</p>
                            </div>
                        </div>

                        {/* POS revenue trend + channel donut */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="font-semibold text-gray-800">POS revenue</h2>
                                    <span className="text-xs text-gray-400">last {days} days</span>
                                </div>
                                <AreaLineChart data={posSeries} valueKey="revenue" color="#8b5cf6" formatValue={money} />
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <h2 className="font-semibold text-gray-800 mb-3">Sales channel split</h2>
                                <DonutChart data={channelData} />
                                <div className="mt-4 space-y-1.5">
                                    {channelData.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center">No sales yet</p>
                                    )}
                                    {channelData.map((d) => (
                                        <div key={d.label} className="flex items-center gap-2 text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                                            <span className="text-gray-600">{d.label}</span>
                                            <span className="text-gray-400 ml-auto">{d.value} orders</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Seller leaderboard + retail/wholesale split */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <FiUsers className="w-4 h-4 text-purple-500" /> Top POS sellers
                                </h2>
                                <HBarList
                                    data={posSellers.map((p) => ({ label: `${p.name}${p.orders ? ` · ${p.orders} orders` : ""}`, value: p.revenue }))}
                                    color="#8b5cf6"
                                    formatValue={money}
                                    emptyText="No POS sales yet"
                                />
                            </div>
                            <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                                <h2 className="font-semibold text-gray-800 mb-3">Retail vs wholesale</h2>
                                <DonutChart data={posTypeData} />
                                <div className="mt-4 space-y-1.5">
                                    {posTypeData.length === 0 && (
                                        <p className="text-xs text-gray-400 text-center">No POS sales yet</p>
                                    )}
                                    {posTypeData.map((d) => (
                                        <div key={d.label} className="flex items-center gap-2 text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                                            <span className="text-gray-600">{d.label}</span>
                                            <span className="text-gray-400 ml-auto">{d.value} orders</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent orders */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800">Recent orders</h2>
                            <Link href="/admin/orders" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1">
                                View all <FiArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                        {recentOrders.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No orders yet</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            <th className="text-left font-semibold px-4 py-3">Order</th>
                                            <th className="text-left font-semibold px-4 py-3">Customer</th>
                                            <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Items</th>
                                            <th className="text-left font-semibold px-4 py-3">Total</th>
                                            <th className="text-left font-semibold px-4 py-3">Status</th>
                                            <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Date</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {recentOrders.map((o) => {
                                            const b = statusBadge(o.orderStatus);
                                            return (
                                                <tr key={o._id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 font-mono text-xs font-medium text-indigo-700 whitespace-nowrap">{o.orderId}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-700 truncate max-w-[140px]">{o.customerName}</div>
                                                        <div className="text-[11px] text-gray-400">{o.customerPhone}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{o.items?.length || 0}</td>
                                                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">{money(o.totalAmount)}</td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${b.color}1a`, color: b.color }}>
                                                            {b.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap hidden md:table-cell">
                                                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-GB") : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* COD Remittance widget — only shown when at least one courier has pending COD */}
                    {remittance && (remittance.pathao?.orderCount > 0 || remittance.steadfast?.orderCount > 0) && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                        <FiCreditCard className="w-5 h-5" />
                                    </span>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">COD Remittance Pending</h3>
                                        <p className="text-xs text-gray-400">Cash held by couriers, not yet bank-transferred</p>
                                    </div>
                                </div>
                                <Link href="/admin/remittance" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                                    View details <FiArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-500 mb-1">Pathao</p>
                                    <p className="text-lg font-bold text-gray-800">{money(remittance.pathao?.totalCOD || 0)}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{remittance.pathao?.orderCount || 0} orders</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <p className="text-xs text-gray-500 mb-1">Steadfast</p>
                                    <p className="text-lg font-bold text-gray-800">{money(remittance.steadfast?.totalCOD || 0)}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{remittance.steadfast?.orderCount || 0} orders</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-3">
                                    <p className="text-xs text-emerald-600 mb-1 font-medium">Total pending</p>
                                    <p className="text-lg font-bold text-emerald-700">
                                        {money((remittance.pathao?.totalCOD || 0) + (remittance.steadfast?.totalCOD || 0))}
                                    </p>
                                    <p className="text-xs text-emerald-500 mt-0.5">
                                        {(remittance.pathao?.orderCount || 0) + (remittance.steadfast?.orderCount || 0)} orders total
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stock by Location widget — only shown when multiWarehouse feature is on */}
                    <StockByLocationWidget store={store} money={money} />

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <Link href="/admin/orders" className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-indigo-400 hover:shadow-sm transition-all flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><FiTruck className="w-5 h-5" /></div>
                            <div className="min-w-0"><p className="font-semibold text-gray-800 text-sm">Orders</p><p className="text-xs text-gray-400 truncate">Manage orders</p></div>
                        </Link>
                        <Link href="/admin/product/all-products" className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-indigo-400 hover:shadow-sm transition-all flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><FiPackage className="w-5 h-5" /></div>
                            <div className="min-w-0"><p className="font-semibold text-gray-800 text-sm">Products</p><p className="text-xs text-gray-400 truncate">{s?.totalProducts ?? 0} products</p></div>
                        </Link>
                        <Link href="/admin/category/all-categories" className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-indigo-400 hover:shadow-sm transition-all flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center"><FiGrid className="w-5 h-5" /></div>
                            <div className="min-w-0"><p className="font-semibold text-gray-800 text-sm">Categories</p><p className="text-xs text-gray-400 truncate">{s?.totalCategories ?? 0} categories</p></div>
                        </Link>
                        <Link href="/admin/settings" className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-indigo-400 hover:shadow-sm transition-all flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><FiStar className="w-5 h-5" /></div>
                            <div className="min-w-0"><p className="font-semibold text-gray-800 text-sm">Site settings</p><p className="text-xs text-gray-400 truncate">Branding & footer</p></div>
                        </Link>
                    </div>
                </>
            )}
        </div>
    );
}
