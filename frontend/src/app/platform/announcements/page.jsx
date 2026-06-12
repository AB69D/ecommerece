"use client";
import { useEffect, useState } from "react";
import {
    FiBell, FiPlus, FiCheck, FiX, FiAlertCircle, FiRefreshCw, FiSlash, FiMail,
    FiGlobe, FiInfo, FiAlertTriangle, FiSend, FiEyeOff,
} from "react-icons/fi";
import { listAnnouncements, createAnnouncement, deactivateAnnouncement, listTenants } from "@/services/platform";
import { useAdminAuth } from "@/context/AdminAuthContext";

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");

const LEVEL_META = {
    info: { label: "Info", cls: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: <FiInfo className="w-3.5 h-3.5" /> },
    warning: { label: "Warning", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: <FiAlertTriangle className="w-3.5 h-3.5" /> },
    critical: { label: "Critical", cls: "bg-red-50 text-red-700 border-red-200", icon: <FiAlertCircle className="w-3.5 h-3.5" /> },
};

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

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

const EMPTY = { title: "", body: "", level: "info", audience: "all", targetTenantId: "", expiresAt: "", sendEmail: false };

export default function AnnouncementsPage() {
    const { me } = useAdminAuth();
    const isPlatformOwner = !!me?.isPlatformOwner;
    const [items, setItems] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [busy, setBusy] = useState(false);

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: "", text: "" }), 5000); };

    const load = async () => {
        setLoading(true);
        try {
            const res = await listAnnouncements();
            if (res?.success) setItems(res.data?.announcements || []);
            else flash("error", res?.message || "Failed to load announcements");
        } catch {
            flash("error", "Could not reach the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isPlatformOwner) return;
        load();
        listTenants("approved").then((res) => { if (res?.success) setStores(res.data?.tenants || []); }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlatformOwner]);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) return flash("error", "Title is required.");
        if (!form.body.trim()) return flash("error", "Message body is required.");
        if (form.audience === "store" && !form.targetTenantId) return flash("error", "Choose a store to target.");
        setBusy(true);
        try {
            const payload = { ...form };
            if (payload.audience === "all") delete payload.targetTenantId;
            if (!payload.expiresAt) delete payload.expiresAt;
            const res = await createAnnouncement(payload);
            if (!res?.success) throw new Error(res?.message || "Could not post announcement");
            flash("success", res.message || "Announcement posted.");
            setShowForm(false);
            setForm(EMPTY);
            await load();
        } catch (err) {
            flash("error", err.message);
        } finally {
            setBusy(false);
        }
    };

    const deactivate = async (id) => {
        try {
            const res = await deactivateAnnouncement(id);
            if (!res?.success) throw new Error(res?.message || "Could not deactivate");
            flash("success", res.message || "Deactivated.");
            await load();
        } catch (e) {
            flash("error", e.message);
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
                <p className="text-sm text-gray-500 mt-2">Broadcast notices to your store owners.</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FiBell className="text-indigo-600" /> Announcements</h1>
                    <p className="text-sm text-gray-500 mt-1">Post a notice to every store — or just one. Owners see it as a banner in their admin.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl"><FiRefreshCw className="w-4 h-4" /> Refresh</button>
                    <button onClick={() => setShowForm((s) => !s)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl"><FiPlus className="w-4 h-4" /> New notice</button>
                </div>
            </div>

            <Banner msg={msg} onClose={() => setMsg({ type: "", text: "" })} />

            {showForm && (
                <form onSubmit={submit} className="mb-6 bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
                    <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1">Title</span>
                        <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Scheduled maintenance this Sunday" maxLength={140} />
                    </label>
                    <label className="block">
                        <span className="block text-sm font-medium text-gray-700 mb-1">Message</span>
                        <textarea className={`${inputCls} resize-none`} rows={4} value={form.body} onChange={(e) => set("body", e.target.value)} placeholder="We'll be upgrading our servers between 2–4am. Your storefront stays online." maxLength={4000} />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700 mb-1">Level</span>
                            <select className={inputCls} value={form.level} onChange={(e) => set("level", e.target.value)}>
                                <option value="info">Info</option>
                                <option value="warning">Warning</option>
                                <option value="critical">Critical</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700 mb-1">Audience</span>
                            <select className={inputCls} value={form.audience} onChange={(e) => set("audience", e.target.value)}>
                                <option value="all">All stores</option>
                                <option value="store">One store</option>
                            </select>
                        </label>
                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700 mb-1">Expires <span className="text-gray-400 font-normal">· optional</span></span>
                            <input type="datetime-local" className={inputCls} value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} />
                        </label>
                    </div>
                    {form.audience === "store" && (
                        <label className="block">
                            <span className="block text-sm font-medium text-gray-700 mb-1">Store</span>
                            <select className={inputCls} value={form.targetTenantId} onChange={(e) => set("targetTenantId", e.target.value)}>
                                <option value="">— Choose a store —</option>
                                {stores.map((s) => (
                                    <option key={s._id} value={s._id}>{s.businessName} ({s.subdomain})</option>
                                ))}
                            </select>
                        </label>
                    )}
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={form.sendEmail} onChange={(e) => set("sendEmail", e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        <FiMail className="w-4 h-4 text-gray-400" /> Also email the store owner(s)
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                        <button type="submit" disabled={busy} className="px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
                            {busy ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSend className="w-4 h-4" />}
                            Post notice
                        </button>
                    </div>
                </form>
            )}

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : items.length === 0 ? (
                <div className="text-center text-gray-400 py-16 border border-dashed border-gray-200 rounded-2xl">No announcements yet.</div>
            ) : (
                <div className="space-y-3">
                    {items.map((a) => {
                        const lvl = LEVEL_META[a.level] || LEVEL_META.info;
                        return (
                            <div key={a._id} className={`border rounded-2xl p-4 ${a.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200 opacity-70"}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${lvl.cls}`}>{lvl.icon}{lvl.label}</span>
                                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                                                {a.audience === "all" ? <><FiGlobe className="w-3 h-3" /> All stores</> : <>→ {a.targetStoreName || "One store"}</>}
                                            </span>
                                            {!a.isActive && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">INACTIVE</span>}
                                            {a.emailSent && <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><FiMail className="w-3 h-3" /> {a.emailedCount}</span>}
                                        </div>
                                        <h3 className="font-semibold text-gray-900 mt-1.5">{a.title}</h3>
                                        <p className="text-sm text-gray-600 mt-0.5 whitespace-pre-wrap">{a.body}</p>
                                        <p className="text-[11px] text-gray-400 mt-1.5">
                                            {fmtDateTime(a.createdAt)}{a.createdBy ? ` · by ${a.createdBy}` : ""}{a.expiresAt ? ` · expires ${fmtDateTime(a.expiresAt)}` : ""}
                                        </p>
                                    </div>
                                    {a.isActive && (
                                        <button onClick={() => deactivate(a._id)} title="Deactivate" className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                            <FiEyeOff className="w-3.5 h-3.5" /> Stop
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
