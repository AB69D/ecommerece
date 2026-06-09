"use client";
import { useState, useEffect, useCallback } from "react";
import {
    FiCalendar, FiTrendingUp, FiDollarSign, FiRotateCcw, FiTag, FiShoppingCart, FiClock,
    FiDownload, FiAlertCircle, FiCheckCircle,
} from "react-icons/fi";
import { useCurrency } from "@/context/CurrencyContext.jsx";
import { getPosReport, getPosSales } from "@/services/pos";

const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

// CSV cell escaping: wrap in quotes if the value contains a comma, quote or newline.
const csvEscape = (v) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export default function ReportsView() {
    const { symbol } = useCurrency();
    const money = (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [toast, setToast] = useState(null); // { type:'error'|'success', text }

    const flash = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3500);
    };

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

    // Pull every sale (paginated) and download as a CSV file the user can open
    // in Excel / Google Sheets. Scope matches the report: own sales, or all
    // sellers' sales for a pos:manage account.
    const downloadCsv = useCallback(async () => {
        setDownloading(true);
        try {
            const all = [];
            let page = 1;
            const limit = 100;
            for (let i = 0; i < 50; i++) { // hard cap: 5,000 rows
                const res = await getPosSales({ page, limit });
                if (!res?.success) {
                    if (all.length === 0) { flash("error", "Could not load sales to export"); return; }
                    break;
                }
                const rows = res.data || [];
                all.push(...rows);
                const totalPages = res.totalNoPage || 1;
                if (page >= totalPages || rows.length === 0) break;
                page += 1;
            }

            if (all.length === 0) { flash("error", "No sales to export yet"); return; }

            const headers = [
                "Order ID", "Date", "Time", "Type", "Customer", "Phone",
                "Payment", "Status", "Items", "Subtotal", "Total", "Seller",
            ];
            const lines = [headers.map(csvEscape).join(",")];
            for (const o of all) {
                const d = o.createdAt ? new Date(o.createdAt) : null;
                const itemsStr = (o.items || [])
                    .map((it) => `${it.productName}${it.weight ? ` (${it.weight})` : ""} x${it.quantity}`)
                    .join(" | ");
                lines.push([
                    o.orderId,
                    d ? d.toLocaleDateString() : "",
                    d ? d.toLocaleTimeString() : "",
                    o.saleType || "retail",
                    o.customerName || "",
                    o.customerPhone || "",
                    o.paymentMethod || "",
                    o.orderStatus || "",
                    itemsStr,
                    o.subtotal ?? "",
                    o.totalAmount ?? "",
                    o.soldBy?.fullName || o.soldBy?.username || "",
                ].map(csvEscape).join(","));
            }

            // Prepend a BOM so Excel reads UTF-8 (currency symbols) correctly.
            const csv = "﻿" + lines.join("\r\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `pos-sales-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            flash("success", `Exported ${all.length} sale${all.length === 1 ? "" : "s"}`);
        } catch {
            flash("error", "Export failed — please try again");
        } finally {
            setDownloading(false);
        }
    }, []);

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
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-800">Your sales</h2>
                        {r.scope === "all" && (
                            <span className="text-xs bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full font-medium">All sellers</span>
                        )}
                    </div>
                    <button
                        onClick={downloadCsv}
                        disabled={downloading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-60 shrink-0"
                    >
                        {downloading
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <FiDownload className="w-4 h-4" />}
                        <span className="hidden sm:inline">{downloading ? "Preparing…" : "Download CSV"}</span>
                    </button>
                </div>

                {toast && (
                    <div className={`p-3 rounded-xl flex items-center gap-2 text-sm border ${toast.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                        {toast.type === "error" ? <FiAlertCircle className="w-4 h-4" /> : <FiCheckCircle className="w-4 h-4" />}
                        {toast.text}
                    </div>
                )}

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
