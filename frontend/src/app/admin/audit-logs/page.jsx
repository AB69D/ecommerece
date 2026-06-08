"use client";
import { useEffect, useState, useCallback } from "react";
import {
    FiFileText, FiSearch, FiChevronLeft, FiChevronRight, FiCheck, FiX,
    FiActivity, FiClock,
} from "react-icons/fi";
import { listAuditLogs, getAuditStats } from "@/services/audit";

const badge = (success) =>
    success
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : "bg-red-50 text-red-700 border-red-200";

export default function AuditLogsPage() {
    const [data, setData] = useState({ items: [], pagination: { page: 1, pages: 1, total: 0 } });
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [q, setQ] = useState("");
    const [success, setSuccess] = useState("");
    const [expanded, setExpanded] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        const res = await listAuditLogs({ page, limit: 25, q, success });
        if (res?.success) setData(res.data);
        setLoading(false);
    }, [page, q, success]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { getAuditStats().then((r) => r?.success && setStats(r.data)); }, []);

    const onSearch = (e) => { e.preventDefault(); setPage(1); load(); };

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FiFileText className="text-indigo-600" /> Audit Logs
                </h1>
                <p className="text-sm text-gray-500 mt-1">Every change made in the admin panel is recorded here.</p>
            </div>

            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-400 text-xs"><FiActivity className="w-4 h-4" /> Total events</div>
                        <div className="text-2xl font-bold text-gray-800 mt-1">{stats.total}</div>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl">
                        <div className="flex items-center gap-2 text-gray-400 text-xs"><FiClock className="w-4 h-4" /> Last 24h</div>
                        <div className="text-2xl font-bold text-gray-800 mt-1">{stats.last24h}</div>
                    </div>
                    <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl col-span-2 sm:col-span-1">
                        <div className="text-gray-400 text-xs mb-1">Top action</div>
                        <div className="text-sm font-semibold text-gray-700 mt-1 truncate">
                            {stats.topActions?.[0]?._id || "—"}
                            {stats.topActions?.[0] && <span className="text-gray-400 font-normal"> ×{stats.topActions[0].count}</span>}
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={onSearch} className="flex flex-wrap gap-2 mb-4">
                <div className="relative flex-1 min-w-[200px]">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, path or message..."
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <select value={success} onChange={(e) => { setSuccess(e.target.value); setPage(1); }}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">All results</option>
                    <option value="true">Success</option>
                    <option value="false">Failed</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">Search</button>
            </form>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="text-left font-semibold px-4 py-3">When</th>
                            <th className="text-left font-semibold px-4 py-3">Actor</th>
                            <th className="text-left font-semibold px-4 py-3">Action</th>
                            <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Details</th>
                            <th className="text-center font-semibold px-4 py-3">Result</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={5} className="text-center py-10"><div className="w-7 h-7 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mx-auto" /></td></tr>
                        ) : data.items.length === 0 ? (
                            <tr><td colSpan={5} className="text-center text-gray-400 py-10">No audit events found.</td></tr>
                        ) : data.items.map((it) => (
                            <tr key={it._id} className="hover:bg-gray-50 cursor-pointer align-top" onClick={() => setExpanded(expanded === it._id ? null : it._id)}>
                                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{new Date(it.createdAt).toLocaleString()}</td>
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-700">@{it.actor?.username || "system"}</div>
                                    <div className="text-[10px] text-gray-400">{it.actor?.role}</div>
                                </td>
                                <td className="px-4 py-3"><span className="font-mono text-xs text-indigo-700">{it.action}</span></td>
                                <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs max-w-xs">
                                    <div className="truncate">{it.message || it.path}</div>
                                    {expanded === it._id && (it.before || it.after || it.meta) && (
                                        <pre className="mt-2 p-2 bg-gray-900 text-gray-100 rounded-lg overflow-x-auto text-[10px] leading-relaxed">
{JSON.stringify({ before: it.before, after: it.after, meta: it.meta, ip: it.ip }, null, 2)}
                                        </pre>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${badge(it.success)}`}>
                                        {it.success ? <FiCheck className="w-3 h-3" /> : <FiX className="w-3 h-3" />}
                                        {it.statusCode || (it.success ? "ok" : "err")}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
                <span>{data.pagination.total} events</span>
                <div className="flex items-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><FiChevronLeft className="w-4 h-4" /></button>
                    <span>Page {data.pagination.page} / {data.pagination.pages || 1}</span>
                    <button disabled={page >= (data.pagination.pages || 1)} onClick={() => setPage((p) => p + 1)}
                        className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"><FiChevronRight className="w-4 h-4" /></button>
                </div>
            </div>
        </div>
    );
}
