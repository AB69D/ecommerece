"use client";
import { useState, useEffect, useCallback } from "react";
import {
    FiCalendar, FiTrendingUp, FiDollarSign, FiRotateCcw, FiTag, FiShoppingCart, FiClock,
} from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getPosReport } from "@/services/pos";

const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function ReportsView() {
    const { symbol } = useCurrency();
    const money = (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getPosReport();
            if (res?.success) setReport(res.data);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-100">
                <div className="w-9 h-9 border-4 border-slate-200 border-t-teal-500 rounded-full animate-spin" />
            </div>
        );
    }

    const r = report || {};
    const retail = r.byType?.retail || { count: 0, revenue: 0 };
    const wholesale = r.byType?.wholesale || { count: 0, revenue: 0 };
    const splitTotal = Math.max(1, retail.revenue + wholesale.revenue);

    return (
        <div className="h-full overflow-y-auto bg-slate-100">
            <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-5">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800">Your sales</h2>
                    {r.scope === "all" && (
                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">All sellers</span>
                    )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard icon={<FiCalendar className="w-5 h-5" />} accent="#14b8a6" label="Today" value={money(r.today?.revenue)} sub={`${r.today?.count || 0} sales`} />
                    <StatCard icon={<FiTrendingUp className="w-5 h-5" />} accent="#6366f1" label="Last 7 days" value={money(r.week?.revenue)} sub={`${r.week?.count || 0} sales`} />
                    <StatCard icon={<FiDollarSign className="w-5 h-5" />} accent="#10b981" label="All time" value={money(r.allTime?.revenue)} sub={`${r.allTime?.count || 0} sales`} />
                    <StatCard icon={<FiRotateCcw className="w-5 h-5" />} accent="#f59e0b" label="Returns" value={r.returns || 0} sub="refunded" />
                </div>

                {/* Retail vs wholesale split */}
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                    <h3 className="font-semibold text-slate-800 mb-3">Retail vs Wholesale</h3>
                    <div className="space-y-3">
                        <SplitRow icon={<FiShoppingCart className="w-4 h-4 text-teal-600" />} label="Retail" count={retail.count} revenue={retail.revenue} pct={(retail.revenue / splitTotal) * 100} color="#14b8a6" money={money} />
                        <SplitRow icon={<FiTag className="w-4 h-4 text-amber-600" />} label="Wholesale" count={wholesale.count} revenue={wholesale.revenue} pct={(wholesale.revenue / splitTotal) * 100} color="#f59e0b" money={money} />
                    </div>
                </div>

                {/* Recent sales */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100">
                        <h3 className="font-semibold text-slate-800">Recent sales</h3>
                    </div>
                    {(!r.recent || r.recent.length === 0) ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No sales yet</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {r.recent.map((o) => (
                                <div key={o._id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-sm font-semibold text-teal-700">{o.orderId}</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${o.saleType === "wholesale" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>
                                                {o.saleType || "retail"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                                            <FiClock className="w-3 h-3" /> {fmtDate(o.createdAt)} · {o.customerName}
                                        </p>
                                    </div>
                                    <span className="font-bold text-slate-900 shrink-0">{money(o.totalAmount)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, accent, label, value, sub }) {
    return (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex items-start justify-between">
                <div className="min-w-0">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="text-lg sm:text-xl font-bold text-slate-800 mt-1 truncate">{value}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
                </div>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

function SplitRow({ icon, label, count, revenue, pct, color, money }) {
    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1.5 text-slate-700 font-medium">{icon} {label}</span>
                <span className="text-slate-500">{money(revenue)} · {count} sales</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(2, pct)}%`, background: color }} />
            </div>
        </div>
    );
}
