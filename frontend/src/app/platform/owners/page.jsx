"use client";
import { useEffect, useState } from "react";
import {
    FiShield, FiUsers, FiUserPlus, FiKey, FiSlash, FiCheck, FiX, FiAlertCircle,
    FiRefreshCw, FiGlobe, FiLogIn, FiPause, FiPlay, FiStar, FiEye, FiEyeOff,
} from "react-icons/fi";
import {
    listOwners, createOwner, revokeOwner, listStoreOwners,
    resetAdminPassword, toggleAdminActive, impersonateStore,
} from "@/services/platform";
import { useAdminAuth } from "@/context/AdminAuthContext";

const TABS = [
    { key: "platform", label: "Platform owners", icon: FiShield },
    { key: "store", label: "Store owners", icon: FiUsers },
];

const STORE_BADGE = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    suspended: "bg-orange-100 text-orange-700 border-orange-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
};

const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");

// Mirror the backend validators so the user gets instant feedback.
const cleanUsername = (v) => v.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 64);
const genPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
    let s = "";
    for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
};

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

export default function OwnersPage() {
    const { me } = useAdminAuth();
    const [tab, setTab] = useState("platform");
    const [owners, setOwners] = useState([]);
    const [storeOwners, setStoreOwners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [busy, setBusy] = useState(false);

    const [createOpen, setCreateOpen] = useState(false);
    const [form, setForm] = useState({ username: "", email: "", fullName: "", password: "" });
    const [showPw, setShowPw] = useState(false);

    const [pwTarget, setPwTarget] = useState(null); // { id, label }
    const [pw, setPw] = useState("");

    const [confirm, setConfirm] = useState(null); // { kind:'revoke'|'toggle', id, label, copy, danger }

    const isPlatformOwner = !!me?.isPlatformOwner;
    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: "", text: "" }), 4000); };

    const load = async () => {
        setLoading(true);
        try {
            if (tab === "platform") {
                const res = await listOwners();
                if (res?.success) setOwners(res.data?.owners || []);
                else flash("error", res?.message || "Failed to load platform owners");
            } else {
                const res = await listStoreOwners();
                if (res?.success) setStoreOwners(res.data?.owners || []);
                else flash("error", res?.message || "Failed to load store owners");
            }
        } catch {
            flash("error", "Could not reach the server.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isPlatformOwner) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, isPlatformOwner]);

    const submitCreate = async (e) => {
        e.preventDefault();
        if (form.password.length < 8) return flash("error", "Password must be at least 8 characters.");
        setBusy(true);
        try {
            const res = await createOwner({
                username: form.username.trim().toLowerCase(),
                email: form.email.trim().toLowerCase(),
                fullName: form.fullName.trim(),
                password: form.password,
            });
            if (!res?.success) throw new Error(res?.message || "Failed to create owner");
            flash("success", res.message || "Platform owner created");
            setCreateOpen(false);
            setForm({ username: "", email: "", fullName: "", password: "" });
            await load();
        } catch (err) {
            flash("error", err.message);
        } finally {
            setBusy(false);
        }
    };

    const submitPassword = async (e) => {
        e.preventDefault();
        if (pw.length < 8) return flash("error", "Password must be at least 8 characters.");
        setBusy(true);
        try {
            const res = await resetAdminPassword(pwTarget.id, pw);
            if (!res?.success) throw new Error(res?.message || "Failed to reset password");
            flash("success", res.message || "Password reset");
            setPwTarget(null);
            setPw("");
        } catch (err) {
            flash("error", err.message);
        } finally {
            setBusy(false);
        }
    };

    const runConfirm = async () => {
        setBusy(true);
        try {
            let res;
            if (confirm.kind === "revoke") res = await revokeOwner(confirm.id);
            else if (confirm.kind === "toggle") res = await toggleAdminActive(confirm.id);
            if (!res?.success) throw new Error(res?.message || "Action failed");
            flash("success", res.message || "Done");
            setConfirm(null);
            await load();
        } catch (err) {
            flash("error", err.message);
        } finally {
            setBusy(false);
        }
    };

    // "Log in as" the store owner: stash the platform token, swap in the store
    // session and hard-navigate into the store's admin. The admin layout shows an
    // exit bar that restores the platform session.
    const doImpersonate = async (row) => {
        setBusy(true);
        try {
            const res = await impersonateStore(row.tenantId);
            if (!res?.success) throw new Error(res?.message || "Failed to access store");
            const token = res.data?.token;
            if (!token) throw new Error("No session was returned.");
            const subdomain = res.data?.store?.subdomain || row.subdomain;
            const cur = localStorage.getItem("admin_token");
            if (cur) localStorage.setItem("admin_owner_token", cur);
            localStorage.setItem("admin_impersonation_store", res.data?.store?.businessName || row.businessName || subdomain);
            localStorage.setItem("admin_token", token);
            window.location.assign(`/${subdomain}/admin`);
        } catch (err) {
            flash("error", err.message);
            setBusy(false);
        }
    };

    // ── Guards ───────────────────────────────────────────────────────────────
    if (me == null) {
        return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>;
    }
    if (!isPlatformOwner) {
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <FiSlash className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">Platform owners only</h1>
                <p className="text-sm text-gray-500 mt-2">
                    This area manages platform owners and every store&apos;s owner account, and is restricted to platform administrators.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiShield className="text-indigo-600" /> Owner Management
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage platform owners and every store&apos;s owner account.</p>
                </div>
                <div className="flex items-center gap-2">
                    {tab === "platform" && (
                        <button onClick={() => { setForm({ username: "", email: "", fullName: "", password: "" }); setShowPw(false); setCreateOpen(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors">
                            <FiUserPlus className="w-4 h-4" /> New platform owner
                        </button>
                    )}
                    <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">
                        <FiRefreshCw className="w-4 h-4" /> Refresh
                    </button>
                </div>
            </div>

            <Banner msg={msg} onClose={() => setMsg({ type: "", text: "" })} />

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                tab === t.key
                                    ? "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                            }`}
                        >
                            <Icon className="w-4 h-4" /> {t.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : tab === "platform" ? (
                <PlatformOwnersTable
                    owners={owners}
                    onResetPw={(o) => { setPw(""); setShowPw(false); setPwTarget({ id: o.id, label: o.username || o.email }); }}
                    onRevoke={(o) => setConfirm({ kind: "revoke", id: o.id, label: o.username || o.email, danger: true, copy: `Remove platform access for "${o.username || o.email}"? Their account stays as a normal store admin.` })}
                    onToggle={(o) => setConfirm({ kind: "toggle", id: o.id, label: o.username, danger: o.isActive, copy: `${o.isActive ? "Deactivate" : "Activate"} "${o.username}"? ${o.isActive ? "They will be unable to sign in." : "They will be able to sign in again."}` })}
                />
            ) : (
                <StoreOwnersTable
                    rows={storeOwners}
                    busy={busy}
                    onImpersonate={doImpersonate}
                    onResetPw={(row) => { setPw(""); setShowPw(false); setPwTarget({ id: row.owner.id, label: row.owner.username || row.owner.email }); }}
                    onToggle={(row) => setConfirm({ kind: "toggle", id: row.owner.id, label: row.owner.username, danger: row.owner.isActive, copy: `${row.owner.isActive ? "Deactivate" : "Activate"} the owner of "${row.businessName}"? ${row.owner.isActive ? "They lose admin access; the storefront keeps running." : "They regain admin access."}` })}
                />
            )}

            {/* ── Create platform owner modal ─────────────────────────────────── */}
            {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !busy && setCreateOpen(false)}>
                    <form onSubmit={submitCreate} className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="font-bold text-gray-800 flex items-center gap-2"><FiUserPlus className="text-indigo-600" /> New platform owner</h2>
                            <button type="button" onClick={() => setCreateOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                                A platform owner has cross-tenant super-admin access: approve stores, manage owners, and step into any store. Their username is the global login identity.
                            </p>
                            <Field label="Username">
                                <input
                                    value={form.username}
                                    onChange={(e) => setForm((f) => ({ ...f, username: cleanUsername(e.target.value) }))}
                                    required minLength={3} maxLength={64} autoCapitalize="none" spellCheck={false}
                                    className={inputCls} placeholder="owner.jane"
                                />
                            </Field>
                            <Field label="Email">
                                <input
                                    type="email" value={form.email}
                                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                    required autoCapitalize="none" spellCheck={false}
                                    className={inputCls} placeholder="jane@yourplatform.com"
                                />
                            </Field>
                            <Field label="Full name" optional>
                                <input
                                    value={form.fullName}
                                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                                    maxLength={100} className={inputCls} placeholder="Jane Doe"
                                />
                            </Field>
                            <Field label="Password">
                                <div className="relative">
                                    <input
                                        type={showPw ? "text" : "password"} value={form.password}
                                        onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                                        required minLength={8} className={`${inputCls} pr-20`} placeholder="At least 8 characters"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                        <button type="button" onClick={() => { setForm((f) => ({ ...f, password: genPassword() })); setShowPw(true); }} title="Generate" className="text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 px-1.5 py-1 rounded">Generate</button>
                                        <button type="button" onClick={() => setShowPw((s) => !s)} className="text-gray-400 hover:text-gray-600 p-1">{showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}</button>
                                    </div>
                                </div>
                            </Field>
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                            <button type="button" onClick={() => setCreateOpen(false)} disabled={busy} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button type="submit" disabled={busy} className="px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
                                {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} Create owner
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Reset password modal ────────────────────────────────────────── */}
            {pwTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !busy && setPwTarget(null)}>
                    <form onSubmit={submitPassword} className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="font-bold text-gray-800 flex items-center gap-2"><FiKey className="text-indigo-600" /> Reset password</h2>
                            <button type="button" onClick={() => setPwTarget(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">Set a new password for <span className="font-semibold text-gray-800">{pwTarget.label}</span>. Share it with them securely; they can change it after signing in.</p>
                            <div className="relative">
                                <input
                                    type={showPw ? "text" : "password"} value={pw}
                                    onChange={(e) => setPw(e.target.value)} required minLength={8} autoFocus
                                    className={`${inputCls} pr-20`} placeholder="At least 8 characters"
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button type="button" onClick={() => { setPw(genPassword()); setShowPw(true); }} title="Generate" className="text-[11px] font-semibold text-indigo-600 hover:bg-indigo-50 px-1.5 py-1 rounded">Generate</button>
                                    <button type="button" onClick={() => setShowPw((s) => !s)} className="text-gray-400 hover:text-gray-600 p-1">{showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}</button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                            <button type="button" onClick={() => setPwTarget(null)} disabled={busy} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button type="submit" disabled={busy} className="px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
                                {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} Reset password
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── Confirm (revoke / toggle) modal ─────────────────────────────── */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="font-bold text-gray-800">{confirm.kind === "revoke" ? "Revoke platform access" : "Update account"}</h2>
                            <button onClick={() => setConfirm(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-5"><p className="text-sm text-gray-600">{confirm.copy}</p></div>
                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                            <button onClick={() => setConfirm(null)} disabled={busy} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button onClick={runConfirm} disabled={busy} className={`px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 disabled:opacity-60 ${confirm.danger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                                {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />} Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const inputCls = "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function Field({ label, optional, children }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {label} {optional && <span className="text-gray-400 font-normal">(optional)</span>}
            </label>
            {children}
        </div>
    );
}

function IconBtn({ title, onClick, Icon, cls, disabled }) {
    return (
        <button onClick={onClick} disabled={disabled} title={title} className={`p-2 rounded-lg disabled:opacity-40 ${cls}`}>
            <Icon className="w-4 h-4" />
        </button>
    );
}

function PlatformOwnersTable({ owners, onResetPw, onRevoke, onToggle }) {
    return (
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                        <th className="text-left font-semibold px-4 py-3">Owner</th>
                        <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Email</th>
                        <th className="text-left font-semibold px-4 py-3">Source</th>
                        <th className="text-left font-semibold px-4 py-3 hidden lg:table-cell">Last login</th>
                        <th className="text-right font-semibold px-4 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {owners.map((o) => (
                        <tr key={o.id || o.email} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                                <div className="font-medium text-gray-800 flex items-center gap-2">
                                    {o.username ? `@${o.username}` : (o.email || "—")}
                                    {o.isSelf && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">YOU</span>}
                                    {!o.isActive && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">DISABLED</span>}
                                </div>
                                {o.fullName && <div className="text-xs text-gray-400">{o.fullName}</div>}
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{o.email || "—"}</td>
                            <td className="px-4 py-3">
                                {o.isEnv ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                        <FiShield className="w-3 h-3" /> env
                                    </span>
                                ) : (
                                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">panel</span>
                                )}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{fmtDateTime(o.lastLoginAt)}</td>
                            <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1">
                                    {o.id && <IconBtn title="Reset password" onClick={() => onResetPw(o)} Icon={FiKey} cls="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" />}
                                    {o.id && !o.isEnv && !o.isSelf && (
                                        <IconBtn title={o.isActive ? "Deactivate" : "Activate"} onClick={() => onToggle(o)} Icon={o.isActive ? FiPause : FiPlay} cls={o.isActive ? "text-orange-600 hover:bg-orange-50" : "text-emerald-600 hover:bg-emerald-50"} />
                                    )}
                                    {o.id && !o.isEnv && !o.isSelf && (
                                        <IconBtn title="Revoke platform access" onClick={() => onRevoke(o)} Icon={FiSlash} cls="text-red-600 hover:bg-red-50" />
                                    )}
                                    {(o.isEnv || o.isSelf) && (!o.id || o.isEnv) && <span className="text-[11px] text-gray-400 italic px-1">Protected</span>}
                                </div>
                            </td>
                        </tr>
                    ))}
                    {owners.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-gray-400 py-12">No platform owners yet.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}

function StoreOwnersTable({ rows, busy, onImpersonate, onResetPw, onToggle }) {
    return (
        <div className="overflow-x-auto border border-gray-100 rounded-xl">
            <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                        <th className="text-left font-semibold px-4 py-3">Store</th>
                        <th className="text-left font-semibold px-4 py-3">Owner</th>
                        <th className="text-left font-semibold px-4 py-3 hidden lg:table-cell">Last login</th>
                        <th className="text-right font-semibold px-4 py-3">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {rows.map((row) => {
                        const o = row.owner;
                        const canImpersonate = row.status === "approved" && o?.id && o?.isActive;
                        return (
                            <tr key={row.tenantId} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <div className="font-medium text-gray-800 flex items-center gap-2">
                                        {row.businessName}
                                        {row.isPrimary && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100 inline-flex items-center gap-0.5"><FiStar className="w-2.5 h-2.5" /> PRIMARY</span>}
                                    </div>
                                    <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                                        <span className="inline-flex items-center gap-1"><FiGlobe className="w-3 h-3" /> {row.subdomain}</span>
                                        <span className={`px-1.5 py-0.5 rounded-full border capitalize ${STORE_BADGE[row.status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>{row.status}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {o ? (
                                        <>
                                            <div className="text-gray-800 flex items-center gap-2">
                                                {o.username ? `@${o.username}` : (o.email || "—")}
                                                {o.isPlatformOwner && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">PLATFORM</span>}
                                                {o.id && !o.isActive && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">DISABLED</span>}
                                            </div>
                                            <div className="text-xs text-gray-400">{o.email || "—"}</div>
                                        </>
                                    ) : <span className="text-gray-400 text-xs">No owner</span>}
                                </td>
                                <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{fmtDateTime(o?.lastLoginAt)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-1">
                                        {canImpersonate && (
                                            <button onClick={() => onImpersonate(row)} disabled={busy} title="Log in as this owner" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-indigo-600 hover:bg-indigo-50 disabled:opacity-40">
                                                <FiLogIn className="w-4 h-4" /> Log in as
                                            </button>
                                        )}
                                        {o?.id && <IconBtn title="Reset password" onClick={() => onResetPw(row)} Icon={FiKey} cls="text-gray-400 hover:text-indigo-600 hover:bg-indigo-50" />}
                                        {o?.id && !o.isPlatformOwner && (
                                            <IconBtn title={o.isActive ? "Deactivate owner" : "Activate owner"} onClick={() => onToggle(row)} Icon={o.isActive ? FiPause : FiPlay} cls={o.isActive ? "text-orange-600 hover:bg-orange-50" : "text-emerald-600 hover:bg-emerald-50"} />
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    {rows.length === 0 && (
                        <tr><td colSpan={4} className="text-center text-gray-400 py-12">No stores yet.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
