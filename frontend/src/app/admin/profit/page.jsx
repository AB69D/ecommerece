"use client";
import { useEffect, useState, useCallback } from "react";
import {
    FiDollarSign, FiTrendingUp, FiPercent, FiTag, FiShoppingCart, FiBox,
    FiBarChart2, FiGlobe, FiShoppingBag,
} from "react-icons/fi";
import { getProfitReport } from "@/services/analytics";
import { AreaLineChart, HBarList } from "@/components/admin/Charts";

const money = (v) => `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const pctText = (v) => `${Number(v || 0).toFixed(1)}%`;

const RANGES = [
    { label: "7d", value: 7 },
    { label: "30d", value: 30 },
    { label: "90d", value: 90 },
    { label: "1y", value: 365 },
];

const CHANNELS = [
    { label: "All", value: "all" },
    { label: "E-commerce", value: "ecommerce" },
    { label: "POS", value: "pos" },
];

function StatCard({ icon, label, value, accent, sub }) {
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 mt-1 truncate">{value}</p>
                    {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

export default function ProfitReportPage() {
    const [days, setDays] = useState(30);
    const [channel, setChannel] = useState("all");
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);
    const [disabled, setDisabled] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setDenied(false);
        setDisabled(false);
        try {
            const res = await getProfitReport(days, channel);
            if (res?.success) {
                setReport(res.data);
            } else if (/disabled/i.test(res?.message || "")) {
                setDisabled(true);
            } else {
                setDenied(true);
            }
        } catch {
            setDenied(true);
        } finally {
            setLoading(false);
        }
    }, [days, channel]);

    useEffect(() => { load(); }, [load]);

    const s = report?.summary;
    const profitSeries = report?.series || [];
    const topProducts = report?.topProducts || [];
    const channels = report?.channels || { ecommerce: { profit: 0, revenue: 0, cost: 0 }, pos: { profit: 0, revenue: 0, cost: 0 } };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Profit &amp; Cost Report</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Margins from cost captured at sale time</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
                        {CHANNELS.map((c) => (
                            <button
                                key={c.value}
                                onClick={() => setChannel(c.value)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${channel === c.value ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
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

            {disabled && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    Profit reporting is turned off. Enable it under <span className="font-medium">Site Settings → Features</span> to view this report.
                </div>
            )}

            {denied && !disabled && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
                    You don&apos;t have permission to view profit analytics.
                </div>
            )}

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                </div>
            ) : (!disabled && !denied && report) ? (
                <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <StatCard icon={<FiDollarSign className="w-5 h-5" />} label="Revenue" value={money(s?.revenue)} accent="#6366f1" sub={`${s?.units ?? 0} units · ${s?.orders ?? 0} orders`} />
                        <StatCard icon={<FiShoppingCart className="w-5 h-5" />} label="Cost of goods" value={money(s?.cost)} accent="#f59e0b" />
                        <StatCard icon={<FiTrendingUp className="w-5 h-5" />} label="Gross profit" value={money(s?.grossProfit)} accent="#10b981" sub={`Margin ${pctText(s?.margin)}`} />
                        <StatCard icon={<FiPercent className="w-5 h-5" />} label="Net profit" value={money(s?.netProfit)} accent="#0ea5e9" sub={`After ${money(s?.discounts)} discounts`} />
                    </div>

                    {/* Profit over time */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                <FiBarChart2 className="w-4 h-4 text-emerald-500" /> Profit over time
                            </h2>
                            <span className="text-xs text-gray-400">last {days} days</span>
                        </div>
                        <AreaLineChart data={profitSeries} valueKey="profit" color="#10b981" formatValue={money} />
                    </div>

                    {/* Channel split + top products */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
                            <h2 className="font-semibold text-gray-800 mb-1">Profit by channel</h2>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50">
                                <span className="flex items-center gap-2 text-sm text-gray-700"><FiGlobe className="w-4 h-4 text-sky-600" /> E-commerce</span>
                                <span className="font-semibold text-gray-800">{money(channels.ecommerce.profit)}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50">
                                <span className="flex items-center gap-2 text-sm text-gray-700"><FiShoppingBag className="w-4 h-4 text-purple-600" /> POS</span>
                                <span className="font-semibold text-gray-800">{money(channels.pos.profit)}</span>
                            </div>
                            <p className="text-[11px] text-gray-400 pt-1">
                                Revenue {money((channels.ecommerce.revenue || 0) + (channels.pos.revenue || 0))} · Cost {money((channels.ecommerce.cost || 0) + (channels.pos.cost || 0))}
                            </p>
                        </div>

                        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
                            <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <FiBox className="w-4 h-4 text-indigo-500" /> Top products by profit
                            </h2>
                            <HBarList
                                data={topProducts.map((p) => ({ label: `${p.name}${p.margin ? ` · ${pctText(p.margin)} margin` : ""}`, value: p.profit }))}
                                color="#10b981"
                                formatValue={money}
                                emptyText="No sales with recorded cost yet"
                            />
                        </div>
                    </div>

                    {/* Detailed product table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-gray-100">
                            <h2 className="font-semibold text-gray-800">Product breakdown</h2>
                        </div>
                        {topProducts.length === 0 ? (
                            <div className="p-8 text-center text-gray-400 text-sm">No data for this range</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            <th className="text-left font-semibold px-4 py-3">Product</th>
                                            <th className="text-right font-semibold px-4 py-3">Units</th>
                                            <th className="text-right font-semibold px-4 py-3">Revenue</th>
                                            <th className="text-right font-semibold px-4 py-3 hidden sm:table-cell">Cost</th>
                                            <th className="text-right font-semibold px-4 py-3">Profit</th>
                                            <th className="text-right font-semibold px-4 py-3">Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {topProducts.map((p) => (
                                            <tr key={p.name} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-700 truncate max-w-[220px]">{p.name}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">{p.qty}</td>
                                                <td className="px-4 py-3 text-right text-gray-700">{money(p.revenue)}</td>
                                                <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{money(p.cost)}</td>
                                                <td className="px-4 py-3 text-right font-semibold text-emerald-600">{money(p.profit)}</td>
                                                <td className="px-4 py-3 text-right text-gray-500">{pctText(p.margin)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <FiTag className="w-3.5 h-3.5" />
                        Profit uses each item&apos;s cost price recorded at the moment of sale. Set cost prices on products to improve accuracy.
                    </p>
                </>
            ) : null}
        </div>
    );
}
