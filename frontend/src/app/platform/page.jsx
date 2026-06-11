"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    FiGlobe, FiShoppingBag, FiDollarSign, FiClock, FiRefreshCw, FiExternalLink,
    FiAlertCircle, FiArrowRight, FiStar, FiUsers,
} from "react-icons/fi";
import { getOverview } from "@/services/platform";

const STORE_BADGE = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    suspended: "bg-orange-100 text-orange-700 border-orange-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
};

const fmtNum = (n) => new Intl.NumberFormat().format(Number(n || 0));
const fmtMoney = (n) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(Number(n || 0));

function StatCard({ icon: Icon, label, value, tint }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tint}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <div className="text-2xl font-bold text-gray-800 leading-none">{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
            </div>
        </div>
    );
}

export default function PlatformOverviewPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getOverview();
            if (res?.success) setData(res.data);
            else setError(res?.message || "Failed to load overview");
        } catch {
            setError("Could not reach the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>;
    }

    const totals = data?.totals || {};
    const stores = data?.stores || [];

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
                    <p className="text-sm text-gray-500 mt-1">Every store on the platform at a glance.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl">
                    <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {error && (
                <div className="mb-5 p-3.5 rounded-xl flex items-center gap-3 text-sm border bg-red-50 text-red-700 border-red-200">
                    <FiAlertCircle className="w-5 h-5 shrink-0" /> {error}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <StatCard icon={FiGlobe} label="Total stores" value={fmtNum(totals.stores)} tint="bg-indigo-50 text-indigo-600" />
                <StatCard icon={FiStar} label="Active stores" value={fmtNum(totals.activeStores)} tint="bg-emerald-50 text-emerald-600" />
                <StatCard icon={FiShoppingBag} label="Total orders" value={fmtNum(totals.orders)} tint="bg-blue-50 text-blue-600" />
                <StatCard icon={FiDollarSign} label="Total revenue" value={fmtMoney(totals.revenue)} tint="bg-amber-50 text-amber-600" />
            </div>

            {totals.pendingStores > 0 && (
                <Link href="/platform/stores" className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors">
                    <span className="flex items-center gap-2 font-medium"><FiClock className="w-4 h-4" /> {totals.pendingStores} store{totals.pendingStores > 1 ? "s" : ""} awaiting approval</span>
                    <span className="inline-flex items-center gap-1 font-semibold">Review <FiArrowRight className="w-4 h-4" /></span>
                </Link>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">Stores</h2>
                    <div className="flex items-center gap-2">
                        <Link href="/platform/owners" className="text-xs font-medium text-gray-500 hover:text-indigo-600 inline-flex items-center gap-1"><FiUsers className="w-3.5 h-3.5" /> Owners</Link>
                        <Link href="/platform/stores" className="text-xs font-medium text-indigo-600 hover:underline inline-flex items-center gap-1">Manage <FiArrowRight className="w-3.5 h-3.5" /></Link>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="text-left font-semibold px-5 py-3">Store</th>
                                <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Owner</th>
                                <th className="text-right font-semibold px-4 py-3">Orders</th>
                                <th className="text-right font-semibold px-4 py-3">Revenue</th>
                                <th className="text-right font-semibold px-5 py-3">Storefront</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stores.map((s) => (
                                <tr key={s.tenantId} className="hover:bg-gray-50">
                                    <td className="px-5 py-3">
                                        <div className="font-medium text-gray-800 flex items-center gap-2">
                                            {s.businessName}
                                            {s.isPrimary && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 inline-flex items-center gap-0.5"><FiStar className="w-2.5 h-2.5" /> PRIMARY</span>}
                                        </div>
                                        <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                                            <span className="inline-flex items-center gap-1"><FiGlobe className="w-3 h-3" /> {s.subdomain}</span>
                                            <span className={`px-1.5 py-0.5 rounded-full border capitalize ${STORE_BADGE[s.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>{s.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                                        {s.owner?.username ? `@${s.owner.username}` : (s.owner?.email || "—")}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-gray-700">{fmtNum(s.orders)}</td>
                                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmtMoney(s.revenue)}</td>
                                    <td className="px-5 py-3 text-right">
                                        <a href={`/${s.subdomain}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline">
                                            Visit <FiExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </td>
                                </tr>
                            ))}
                            {stores.length === 0 && (
                                <tr><td colSpan={5} className="text-center text-gray-400 py-12">No stores yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
