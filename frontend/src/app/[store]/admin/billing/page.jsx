"use client";
import { useEffect, useState, useCallback } from "react";
import {
    FiCreditCard, FiPackage, FiGrid, FiUsers, FiShoppingCart, FiAlertCircle,
    FiCheckCircle, FiLock, FiRefreshCw, FiCalendar, FiTrendingUp,
} from "react-icons/fi";
import { getMyBilling } from "@/services/billing";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useCurrency } from "@/context/CurrencyContext";

const fmtMoney = (amount, currency = "USD") => {
    const n = Number(amount || 0);
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
    } catch {
        return `${currency} ${n.toLocaleString()}`;
    }
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");

// One usage metric vs its plan limit. limit 0 / missing => unlimited (no bar cap).
function UsageRow({ icon, label, used, limit }) {
    const unlimited = !limit || Number(limit) <= 0;
    const u = Number(used || 0);
    const pct = unlimited ? 0 : Math.min(100, Math.round((u / Number(limit)) * 100));
    const over = !unlimited && u > Number(limit);
    const near = !unlimited && !over && pct >= 80;
    const barColor = over ? "bg-red-500" : near ? "bg-amber-500" : "bg-indigo-500";
    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">{icon}</span>
                    {label}
                </div>
                <div className="text-sm font-semibold text-gray-800">
                    {u.toLocaleString()}
                    <span className="text-gray-400 font-normal"> / {unlimited ? "∞" : Number(limit).toLocaleString()}</span>
                </div>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className={`h-full rounded-full ${unlimited ? "bg-emerald-400" : barColor}`} style={{ width: unlimited ? "100%" : `${pct}%`, opacity: unlimited ? 0.25 : 1 }} />
            </div>
            <p className={`mt-1.5 text-[11px] ${over ? "text-red-600" : near ? "text-amber-600" : "text-gray-400"}`}>
                {unlimited ? "Unlimited on your plan" : over ? "Over your plan limit — please upgrade" : near ? "Approaching your plan limit" : `${pct}% used`}
            </p>
        </div>
    );
}

const BILLING_STATE = {
    active: { cls: "bg-emerald-50 border-emerald-200 text-emerald-800", icon: <FiCheckCircle className="w-5 h-5" />, title: "Your account is in good standing" },
    past_due: { cls: "bg-amber-50 border-amber-200 text-amber-800", icon: <FiAlertCircle className="w-5 h-5" />, title: "Payment past due" },
    locked: { cls: "bg-red-50 border-red-200 text-red-800", icon: <FiLock className="w-5 h-5" />, title: "Account locked" },
};

export default function BillingPage() {
    const { code: currencyCode } = useCurrency();
    const { can } = useAdminAuth();
    const canBilling = can("settings:manage"); // owner-only
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getMyBilling();
            if (res?.success) setData(res.data);
            else setError(res?.message || "Could not load billing.");
        } catch {
            setError("Could not reach the server.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (canBilling) load(); }, [load, canBilling]);

    // Defence-in-depth: the sidebar already hides this from non-owners, but a
    // staff member could still type the URL. Billing is an owner-level concern.
    if (!canBilling) {
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <FiLock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <h1 className="text-xl font-bold text-gray-800">Owners only</h1>
                <p className="text-sm text-gray-500 mt-2">Billing &amp; plan details are visible to the store owner.</p>
            </div>
        );
    }

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>;
    }
    if (error) {
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <FiAlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <p className="text-gray-600">{error}</p>
                <button onClick={load} className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl">
                    <FiRefreshCw className="w-4 h-4" /> Try again
                </button>
            </div>
        );
    }

    const { plan, billing, subscription, usage, store } = data || {};
    const currency = currencyCode || plan?.currency || "USD";
    const state = BILLING_STATE[billing?.status || "active"] || BILLING_STATE.active;
    const limits = plan?.limits || {};

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiCreditCard className="text-indigo-600" /> Billing &amp; Plan
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Your subscription, usage this period, and balance.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl">
                    <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* Billing status banner */}
            <div className={`flex items-start gap-3 p-4 rounded-2xl border ${state.cls}`}>
                <span className="mt-0.5 shrink-0">{state.icon}</span>
                <div className="flex-1 min-w-0">
                    <p className="font-semibold">{state.title}</p>
                    {billing?.status === "locked" && billing?.lockedReason && (
                        <p className="text-sm mt-0.5">{billing.lockedReason}</p>
                    )}
                    {billing?.status === "locked" && !billing?.lockedReason && (
                        <p className="text-sm mt-0.5">Your store admin is locked. Please settle your balance to restore access.</p>
                    )}
                    {billing?.status === "past_due" && (
                        <p className="text-sm mt-0.5">Please settle your outstanding balance to avoid interruption.</p>
                    )}
                    {(billing?.balanceDue ?? 0) > 0 && (
                        <p className="text-sm mt-1 font-medium">Balance due: {fmtMoney(billing.balanceDue, currency)}</p>
                    )}
                </div>
            </div>

            {/* Plan + period */}
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Current plan</p>
                    {plan ? (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-bold text-gray-900">{plan.name}</span>
                                <span className="text-sm text-gray-500">
                                    {Number(plan.price) > 0 ? `${fmtMoney(plan.price, currency)} / ${plan.interval || "monthly"}` : "Free"}
                                </span>
                            </div>
                            <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                                <p className="flex items-center gap-2">
                                    <FiTrendingUp className="w-4 h-4 text-gray-400" />
                                    Monthly sales limit:{" "}
                                    <span className="font-medium text-gray-800">
                                        {Number(plan.salesLimit) > 0 ? fmtMoney(plan.salesLimit, currency) : "Unlimited"}
                                    </span>
                                </p>
                                {Number(plan.salesLimit) > 0 && plan.overage?.mode && plan.overage.mode !== "none" && (
                                    <p className="text-xs text-gray-400">
                                        {plan.overage.mode === "percent"
                                            ? `Overage: ${plan.overage.percent}% of sales above the limit`
                                            : `Overage: ${fmtMoney(plan.overage.blockFee, currency)} per ${fmtMoney(plan.overage.blockSize, currency)} above the limit`}
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500">No plan assigned yet. The platform team will set you up shortly.</p>
                    )}
                </div>

                <div className="bg-white border border-gray-200 rounded-2xl p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Billing period</p>
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-2"><FiCalendar className="w-4 h-4 text-gray-400" /> Sales this period</span>
                            <span className="font-semibold text-gray-800">{fmtMoney(billing?.currentPeriodSales, currency)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500">Current period</span>
                            <span className="text-gray-700">{fmtDate(subscription?.currentPeriodStart)} – {fmtDate(subscription?.currentPeriodEnd)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500">Subscription</span>
                            <span className="capitalize text-gray-700">{subscription?.status || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-gray-500">Member since</span>
                            <span className="text-gray-700">{fmtDate(store?.since)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Usage */}
            <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Usage this period</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <UsageRow icon={<FiPackage className="w-4 h-4" />} label="Products" used={usage?.products} limit={limits.maxProducts} />
                    <UsageRow icon={<FiGrid className="w-4 h-4" />} label="Categories" used={usage?.categories} limit={limits.maxCategories} />
                    <UsageRow icon={<FiUsers className="w-4 h-4" />} label="Staff" used={usage?.staff} limit={limits.maxStaff} />
                    <UsageRow icon={<FiShoppingCart className="w-4 h-4" />} label="Orders this month" used={usage?.ordersThisMonth} limit={limits.maxOrdersPerMonth} />
                </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
                Questions about your plan or an invoice? Contact the platform team — billing changes are handled by the platform owner.
            </p>
        </div>
    );
}
