"use client";
import { useCallback, useEffect, useState } from "react";
import {
    FiSearch, FiChevronLeft, FiChevronRight, FiArrowUp, FiArrowDown, FiList,
} from "react-icons/fi";
import { authFetch } from "@/services/api";

const REASONS = [
    { value: "", label: "All reasons" },
    { value: "sale", label: "Sale" },
    { value: "return", label: "Return" },
    { value: "cancel", label: "Cancel/restock" },
    { value: "adjustment", label: "Manual adjust" },
];

const CHANNELS = [
    { value: "", label: "All channels" },
    { value: "pos", label: "POS" },
    { value: "ecommerce", label: "E-commerce" },
    { value: "chatbot", label: "Chatbot" },
    { value: "admin", label: "Admin" },
];

const REASON_BADGE = {
    sale: { label: "Sale", cls: "bg-indigo-50 text-indigo-700" },
    return: { label: "Return", cls: "bg-emerald-50 text-emerald-700" },
    cancel: { label: "Restock", cls: "bg-amber-50 text-amber-700" },
    adjustment: { label: "Adjust", cls: "bg-sky-50 text-sky-700" },
};

const CHANNEL_BADGE = {
    pos: "bg-purple-50 text-purple-700",
    ecommerce: "bg-sky-50 text-sky-700",
    chatbot: "bg-teal-50 text-teal-700",
    admin: "bg-gray-100 text-gray-600",
    system: "bg-gray-100 text-gray-500",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : "—");

export default function StockLedgerPage() {
    const [rows, setRows] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [denied, setDenied] = useState(false);
    const [disabled, setDisabled] = useState(false);

    const [search, setSearch] = useState("");
    const [reason, setReason] = useState("");
    const [channel, setChannel] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setDenied(false);
        setDisabled(false);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "30" });
            if (search.trim()) params.set("search", search.trim());
            if (reason) params.set("reason", reason);
            if (channel) params.set("channel", channel);
            const res = await authFetch(`/api/admin/stock/ledger?${params.toString()}`);
            const d = await res.json();
            if (d?.success) {
                setRows(d.data?.data || []);
                setTotalPages(d.data?.totalNoPage || 1);
                setTotalCount(d.data?.totalCount || 0);
            } else if (/disabled/i.test(d?.message || "")) {
                setDisabled(true);
            } else {
                setDenied(true);
            }
        } catch {
            setDenied(true);
        } finally {
            setLoading(false);
        }
    }, [page, search, reason, channel]);

    useEffect(() => { load(); }, [load]);

    // Reset to page 1 whenever a filter changes.
    useEffect(() => { setPage(1); }, [search, reason, channel]);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiList className="w-6 h-6 text-indigo-600" /> Stock Ledger
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">Every inventory movement, newest first</p>
                </div>
                {!disabled && !denied && (
                    <span className="text-sm text-gray-400">{totalCount.toLocaleString()} movements</span>
                )}
            </div>

            {disabled && (
                <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    The stock ledger is turned off. Enable it under <span className="font-medium">Site Settings → Features</span> to start recording inventory movements.
                </div>
            )}

            {denied && !disabled && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
                    You don&apos;t have permission to view the stock ledger.
                </div>
            )}

            {!disabled && !denied && (
                <>
                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative flex-1 min-w-[200px]">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search product or order ID..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="py-2.5 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <select
                            value={channel}
                            onChange={(e) => setChannel(e.target.value)}
                            className="py-2.5 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                            {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="h-64 flex items-center justify-center">
                                <div className="w-9 h-9 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 text-sm">No stock movements found</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                        <tr>
                                            <th className="text-left font-semibold px-4 py-3">When</th>
                                            <th className="text-left font-semibold px-4 py-3">Product</th>
                                            <th className="text-right font-semibold px-4 py-3">Change</th>
                                            <th className="text-left font-semibold px-4 py-3">Reason</th>
                                            <th className="text-left font-semibold px-4 py-3 hidden sm:table-cell">Channel</th>
                                            <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Order</th>
                                            <th className="text-left font-semibold px-4 py-3 hidden lg:table-cell">By</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {rows.map((m) => {
                                            const rb = REASON_BADGE[m.reason] || { label: m.reason, cls: "bg-gray-100 text-gray-600" };
                                            const up = m.delta >= 0;
                                            return (
                                                <tr key={m._id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fmtDate(m.createdAt)}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-700 truncate max-w-[200px]">{m.productName || "—"}</div>
                                                        {m.weight && <div className="text-[11px] text-gray-400">{m.weight}</div>}
                                                    </td>
                                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 font-semibold ${up ? "text-emerald-600" : "text-red-500"}`}>
                                                            {up ? <FiArrowUp className="w-3.5 h-3.5" /> : <FiArrowDown className="w-3.5 h-3.5" />}
                                                            {up ? "+" : ""}{m.delta}
                                                        </span>
                                                        {m.balanceAfter !== null && m.balanceAfter !== undefined && (
                                                            <div className="text-[11px] text-gray-400">→ {m.balanceAfter}</div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${rb.cls}`}>{rb.label}</span>
                                                    </td>
                                                    <td className="px-4 py-3 hidden sm:table-cell">
                                                        <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${CHANNEL_BADGE[m.channel] || "bg-gray-100 text-gray-600"}`}>{m.channel}</span>
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs text-indigo-700 hidden md:table-cell whitespace-nowrap">{m.orderId || "—"}</td>
                                                    <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{m.actor?.fullName || m.actor?.username || "Customer"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                            >
                                <FiChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="p-2 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                            >
                                <FiChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
