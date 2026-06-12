"use client";
import { useEffect, useState } from "react";
import {
    FiTag, FiPlus, FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiSlash, FiTrendingUp,
} from "react-icons/fi";
import { listPlans, createPlan } from "@/services/platform";
import { useAdminAuth } from "@/context/AdminAuthContext";

const fmtMoney = (amount, currency = "BDT") => {
    const n = Number(amount || 0);
    try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
    } catch {
        return `${currency} ${n.toLocaleString()}`;
    }
};

const EMPTY = {
    name: "", slug: "", description: "", price: 0, currency: "BDT", interval: "monthly",
    salesLimit: 0, maxProducts: 0, maxStaff: 0, maxCategories: 0, maxOrdersPerMonth: 0,
};

// Keep the slug machine-safe and in sync with the name until the user edits it.
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function Banner({ msg, onClose }) {
    if (!msg?.text) return null;
    const ok = msg.type === "success";
    return (
        <div className={`mb-5 p-3.5 rounded-xl flex items-start gap-3 text-sm border ${ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
            {ok ? <FiCheck className="w-5 h-5 mt-0.5 shrink-0" /> : <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
            <span className="flex-1">{msg.text}</span>
            <button onClick={onClose} aria-label="Dismiss"><FiX className="w-4 h-4" /></button>
        </div>
    );
}

function Field({ label, hint, children }) {
    return (
        <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">{label}{hint && <span className="text-gray-400 font-normal"> · {hint}</span>}</span>
            {children}
        </label>
    );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function PlansPage() {
    const { me } = useAdminAuth();
    const isPlatformOwner = !!me?.isPlatformOwner;
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [slugTouched, setSlugTouched] = useState(false);
    const [busy, setBusy] = useState(false);

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: "", text: "" }), 5000); };

    const load = async () => {
        setLoading(true);
        try {
            const res = await listPlans();
            if (res?.success) setPlans(res.data?.plans || []);
            else flash("error", res?.message || "Failed to load plans");
        } catch {
            flash("error", "Could not reach the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isPlatformOwner) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlatformOwner]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return flash("error", "Plan name is required.");
        const slug = slugTouched ? form.slug : slugify(form.name);
        setBusy(true);
        try {
            const res = await createPlan({ ...form, slug });
            if (!res?.success) throw new Error(res?.message || "Could not create plan");
            flash("success", res.message || "Plan created.");
            setShowForm(false);
            setForm(EMPTY);
            setSlugTouched(false);
            await load();
        } catch (err) {
            flash("error", err.message);
        } finally {
            setBusy(false);
        }
    };

    if (me == null) {
        return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>;
    }
    if (!isPlatformOwner) {
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4"><FiSlash className="w-7 h-7 text-red-500" /></div>
                <h1 className="text-xl font-bold text-gray-800">Platform owners only</h1>
                <p className="text-sm text-gray-500 mt-2">Plans are the subscription tiers you offer to stores.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FiTag className="text-indigo-600" /> Plans</h1>
                    <p className="text-sm text-gray-500 mt-1">Subscription tiers you assign to stores. Limits and overage are fully configurable.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl"><FiRefreshCw className="w-4 h-4" /> Refresh</button>
                    <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl"><FiPlus className="w-4 h-4" /> New plan</button>
                </div>
            </div>

            <Banner msg={msg} onClose={() => setMsg({ type: "", text: "" })} />

            {showForm && (
                <form onSubmit={submit} className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name">
                            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Starter" maxLength={60} />
                        </Field>
                        <Field label="Slug" hint="lowercase id">
                            <input className={inputCls} value={slugTouched ? form.slug : slugify(form.name)} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} placeholder="starter" maxLength={40} />
                        </Field>
                    </div>
                    <Field label="Description" hint="optional">
                        <input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Best for growing stores" maxLength={200} />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Price">
                            <input type="number" min={0} className={inputCls} value={form.price} onChange={(e) => set("price", e.target.value)} />
                        </Field>
                        <Field label="Currency">
                            <input className={inputCls} value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} maxLength={3} />
                        </Field>
                        <Field label="Interval">
                            <select className={inputCls} value={form.interval} onChange={(e) => set("interval", e.target.value)}>
                                <option value="monthly">Monthly</option>
                                <option value="yearly">Yearly</option>
                            </select>
                        </Field>
                    </div>
                    <Field label="Monthly sales limit" hint="0 = unlimited">
                        <input type="number" min={0} className={inputCls} value={form.salesLimit} onChange={(e) => set("salesLimit", e.target.value)} />
                    </Field>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Resource limits · 0 = unlimited</p>
                        <div className="grid gap-4 sm:grid-cols-4">
                            <Field label="Products"><input type="number" min={0} className={inputCls} value={form.maxProducts} onChange={(e) => set("maxProducts", e.target.value)} /></Field>
                            <Field label="Categories"><input type="number" min={0} className={inputCls} value={form.maxCategories} onChange={(e) => set("maxCategories", e.target.value)} /></Field>
                            <Field label="Staff"><input type="number" min={0} className={inputCls} value={form.maxStaff} onChange={(e) => set("maxStaff", e.target.value)} /></Field>
                            <Field label="Orders / month"><input type="number" min={0} className={inputCls} value={form.maxOrdersPerMonth} onChange={(e) => set("maxOrdersPerMonth", e.target.value)} /></Field>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); setSlugTouched(false); }} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                        <button type="submit" disabled={busy} className="px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
                            {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            Create plan
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : plans.length === 0 ? (
                <div className="text-center text-gray-400 py-16 border border-dashed border-gray-200 rounded-2xl">
                    No plans yet. Create your first plan to start assigning stores to it.
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {plans.map((p) => (
                        <div key={p._id} className="bg-white border border-gray-200 rounded-2xl p-5">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <div className="text-lg font-bold text-gray-900">{p.name}</div>
                                    <div className="text-xs text-gray-400">{p.slug}</div>
                                </div>
                                {!p.isActive && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">INACTIVE</span>}
                            </div>
                            {p.description && <p className="text-sm text-gray-500 mt-2">{p.description}</p>}
                            <div className="mt-3 flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-gray-900">{Number(p.price) > 0 ? fmtMoney(p.price, p.currency) : "Free"}</span>
                                {Number(p.price) > 0 && <span className="text-sm text-gray-400">/ {p.billingInterval || "monthly"}</span>}
                            </div>
                            <dl className="mt-4 space-y-1.5 text-sm">
                                <Stat icon={<FiTrendingUp className="w-3.5 h-3.5" />} k="Sales limit" v={Number(p.salesLimit) > 0 ? fmtMoney(p.salesLimit, p.currency) : "Unlimited"} />
                                <Stat k="Products" v={p.limits?.maxProducts || "Unlimited"} />
                                <Stat k="Categories" v={p.limits?.maxCategories || "Unlimited"} />
                                <Stat k="Staff" v={p.limits?.maxStaff || "Unlimited"} />
                                <Stat k="Orders / month" v={p.limits?.maxOrdersPerMonth || "Unlimited"} />
                            </dl>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function Stat({ icon, k, v }) {
    return (
        <div className="flex items-center justify-between">
            <dt className="text-gray-400 flex items-center gap-1.5">{icon}{k}</dt>
            <dd className="text-gray-800 font-medium">{typeof v === "number" ? v.toLocaleString() : v}</dd>
        </div>
    );
}
