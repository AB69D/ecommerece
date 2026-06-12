"use client";
import { useEffect, useMemo, useState } from "react";
import {
    FiGlobe, FiCheck, FiX, FiAlertCircle, FiSlash, FiPause, FiPlay,
    FiEye, FiRefreshCw, FiClock, FiUser, FiExternalLink, FiUsers, FiKey, FiShield,
    FiCreditCard, FiLock, FiCopy, FiRotateCw, FiCheckCircle, FiDownload, FiDatabase,
} from "react-icons/fi";
import {
    listTenants, getTenant, listTenantUsers, approveTenant, suspendTenant, rejectTenant,
    resetAdminPassword, toggleAdminActive, listPlans, assignPlan, setBilling, exportTenantData,
} from "@/services/platform";

const genPassword = () => {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%";
    let s = "";
    for (let i = 0; i < 14; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
};
import { useAdminAuth } from "@/context/AdminAuthContext";

const STATUS_TABS = [
    { key: "", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "suspended", label: "Suspended" },
    { key: "rejected", label: "Rejected" },
];

const STATUS_BADGE = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
    suspended: "bg-orange-100 text-orange-700 border-orange-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
};

const BILLING_BADGE = {
    active: "text-emerald-600",
    past_due: "text-amber-600",
    locked: "text-red-600",
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString() : "—");

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

function StatusBadge({ status }) {
    return (
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${STATUS_BADGE[status] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
            {status}
        </span>
    );
}

// What the action buttons say/do for each lifecycle action.
const ACTION_META = {
    approve: { verb: "Approve", needsReason: false, danger: false,
        copy: (t) => `Approve "${t.businessName}"? This activates the owner's login and makes the store live.` },
    suspend: { verb: "Suspend", needsReason: true, danger: true,
        copy: (t) => `Suspend "${t.businessName}"? The owner loses admin access until you resume it. The storefront keeps running.` },
    resume: { verb: "Resume", needsReason: false, danger: false,
        copy: (t) => `Resume "${t.businessName}"? This restores the owner's admin access.` },
    reject: { verb: "Reject", needsReason: true, danger: true,
        copy: (t) => `Reject "${t.businessName}"? The owner will not be able to log in.` },
};

export default function StoresPage() {
    const { me } = useAdminAuth();
    const [tab, setTab] = useState("");
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const [confirm, setConfirm] = useState(null); // { type, tenant }
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const [detail, setDetail] = useState(null); // { tenant, owner }
    const [detailLoading, setDetailLoading] = useState(false);
    const [users, setUsers] = useState(null); // store staff for the open detail
    const [plans, setPlans] = useState([]); // plans available to assign
    const [pwTarget, setPwTarget] = useState(null); // { id, username } for the reset-password modal
    const [backupBusy, setBackupBusy] = useState(false);

    const isPlatformOwner = !!me?.isPlatformOwner;

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: "", text: "" }), 4000); };

    const load = async () => {
        setLoading(true);
        try {
            const res = await listTenants(tab);
            if (res?.success) setTenants(res.data?.tenants || []);
            else flash("error", res?.message || "Failed to load stores");
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

    // Plans rarely change; load once so the detail modal can offer them.
    useEffect(() => {
        if (!isPlatformOwner) return;
        listPlans().then((res) => { if (res?.success) setPlans(res.data?.plans || []); }).catch(() => {});
    }, [isPlatformOwner]);

    const counts = useMemo(() => {
        const c = {};
        tenants.forEach((t) => { c[t.status] = (c[t.status] || 0) + 1; });
        return c;
    }, [tenants]);

    const openConfirm = (type, tenant) => { setReason(""); setConfirm({ type, tenant }); };

    const runAction = async () => {
        const { type, tenant } = confirm;
        setBusy(true);
        try {
            let res;
            if (type === "approve") res = await approveTenant(tenant._id);
            else if (type === "suspend") res = await suspendTenant(tenant._id, reason);
            else if (type === "resume") res = await suspendTenant(tenant._id); // toggle back
            else if (type === "reject") res = await rejectTenant(tenant._id, reason);

            if (!res?.success) throw new Error(res?.message || "Action failed");
            flash("success", res.message || "Done");
            setConfirm(null);
            setDetail(null);
            await load();
        } catch (e) {
            flash("error", e.message);
        } finally {
            setBusy(false);
        }
    };

    const openDetail = async (id) => {
        setDetail({ loading: true });
        setDetailLoading(true);
        setUsers(null);
        try {
            const [res, ures] = await Promise.all([getTenant(id), listTenantUsers(id)]);
            if (res?.success) setDetail(res.data);
            else { flash("error", res?.message || "Failed to load store"); setDetail(null); }
            if (ures?.success) setUsers(ures.data?.users || []);
        } catch {
            flash("error", "Could not load store details.");
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    // Reload just the store-users list (after a reset / toggle).
    const reloadUsers = async (id) => {
        const ures = await listTenantUsers(id).catch(() => null);
        if (ures?.success) setUsers(ures.data?.users || []);
    };

    // Download a full JSON data backup of a store (categories, products, orders,
    // customers, coupons, reviews, staff). Streams the authenticated response to a
    // file via a temporary object URL.
    const downloadBackup = async (tenant) => {
        setBackupBusy(true);
        try {
            const res = await exportTenantData(tenant._id);
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.message || "Backup failed");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${tenant.subdomain}-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            flash("success", `Backup downloaded for ${tenant.businessName}`);
        } catch (e) {
            flash("error", e.message || "Backup failed");
        } finally {
            setBackupBusy(false);
        }
    };

    // Open the reset-password support modal for a store user (owner or staff).
    // The modal sets a new password and reveals it once so the platform owner can
    // hand it to the store. Existing passwords are hashed and can never be shown.
    const openPwReset = (user) => setPwTarget({ id: user.id || user._id, username: user.username });

    // Activate / deactivate a store user (the backend blocks self + env owners).
    const toggleUser = async (user, tenantId) => {
        try {
            const res = await toggleAdminActive(user.id);
            if (!res?.success) throw new Error(res?.message || "Update failed");
            flash("success", res.message || "Done");
            await reloadUsers(tenantId);
        } catch (e) {
            flash("error", e.message);
        }
    };

    // Contextual action buttons for a tenant row / detail footer.
    const ActionButtons = ({ t, size = "icon" }) => {
        if (t.isPrimary) {
            return <span className="text-xs text-gray-400 italic">Primary store</span>;
        }
        const btn = (key, label, Icon, cls) =>
            size === "icon" ? (
                <button key={key} onClick={() => openConfirm(key, t)} title={label} className={`p-2 rounded-lg ${cls}`}>
                    <Icon className="w-4 h-4" />
                </button>
            ) : (
                <button key={key} onClick={() => openConfirm(key, t)} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg ${cls}`}>
                    <Icon className="w-4 h-4" /> {label}
                </button>
            );

        const out = [];
        if (t.status === "pending") {
            out.push(btn("approve", "Approve", FiCheck, "text-emerald-600 hover:bg-emerald-50"));
            out.push(btn("reject", "Reject", FiSlash, "text-red-600 hover:bg-red-50"));
        } else if (t.status === "approved") {
            out.push(btn("suspend", "Suspend", FiPause, "text-orange-600 hover:bg-orange-50"));
        } else if (t.status === "suspended") {
            out.push(btn("resume", "Resume", FiPlay, "text-emerald-600 hover:bg-emerald-50"));
        }
        return out;
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
                    This area manages every store on the platform and is restricted to platform administrators.
                </p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiGlobe className="text-indigo-600" /> Stores
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Review signups, approve stores, and manage the fleet.</p>
                </div>
                <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">
                    <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            <Banner msg={msg} onClose={() => setMsg({ type: "", text: "" })} />

            {/* Status tabs */}
            <div className="flex flex-wrap gap-2 mb-5">
                {STATUS_TABS.map((s) => (
                    <button
                        key={s.key}
                        onClick={() => setTab(s.key)}
                        className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            tab === s.key
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
                        }`}
                    >
                        {s.label}
                        {s.key && counts[s.key] != null && tab === "" && (
                            <span className="ml-1.5 text-xs opacity-70">{counts[s.key]}</span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
            ) : (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                            <tr>
                                <th className="text-left font-semibold px-4 py-3">Store</th>
                                <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Owner</th>
                                <th className="text-left font-semibold px-4 py-3">Status</th>
                                <th className="text-left font-semibold px-4 py-3 hidden lg:table-cell">Registered</th>
                                <th className="text-right font-semibold px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {tenants.map((t) => (
                                <tr key={t._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800 flex items-center gap-2">
                                            {t.businessName}
                                            {t.isPrimary && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">PRIMARY</span>}
                                        </div>
                                        <div className="text-xs text-gray-400 flex items-center gap-1">
                                            <FiGlobe className="w-3 h-3" /> {t.subdomain}
                                            {t.billing?.status && t.billing.status !== "active" && (
                                                <span className={`ml-1 ${BILLING_BADGE[t.billing.status] || ""}`}>· {t.billing.status.replace("_", " ")}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">{t.ownerEmail || "—"}</td>
                                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{fmtDate(t.createdAt)}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <ActionButtons t={t} />
                                            <button onClick={() => openDetail(t._id)} title="View details" className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                                <FiEye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {tenants.length === 0 && (
                                <tr><td colSpan={5} className="text-center text-gray-400 py-12">No stores{tab ? ` with status "${tab}"` : ""} yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Confirm action modal ─────────────────────────────────────── */}
            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !busy && setConfirm(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100">
                            <h2 className="font-bold text-gray-800">{ACTION_META[confirm.type].verb} store</h2>
                            <button onClick={() => setConfirm(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-sm text-gray-600">{ACTION_META[confirm.type].copy(confirm.tenant)}</p>
                            {ACTION_META[confirm.type].needsReason && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-gray-400 font-normal">(optional, internal)</span></label>
                                    <textarea
                                        value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000}
                                        placeholder="Noted on the store for your records."
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                            <button onClick={() => setConfirm(null)} disabled={busy} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button
                                onClick={runAction} disabled={busy}
                                className={`px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 disabled:opacity-60 ${
                                    ACTION_META[confirm.type].danger ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                                }`}
                            >
                                {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {ACTION_META[confirm.type].verb}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Detail modal ─────────────────────────────────────────────── */}
            {detail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
                            <h2 className="font-bold text-gray-800">Store details</h2>
                            <button onClick={() => setDetail(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                        </div>

                        {detailLoading || detail.loading ? (
                            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                        ) : (
                            <>
                                <div className="p-5 space-y-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                                {detail.tenant.businessName}
                                                {detail.tenant.isPrimary && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">PRIMARY</span>}
                                            </div>
                                            <div className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
                                                <FiGlobe className="w-3.5 h-3.5" /> {detail.tenant.subdomain}
                                            </div>
                                        </div>
                                        <StatusBadge status={detail.tenant.status} />
                                    </div>

                                    <Section title="Owner" icon={FiUser}>
                                        {detail.owner ? (
                                            <>
                                                <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
                                                    <Row k="Name" v={detail.owner.fullName || "—"} />
                                                    <Row k="Username" v={`@${detail.owner.username}`} />
                                                    <Row k="Email" v={detail.owner.email || "—"} />
                                                    <Row k="Login" v={detail.owner.isActive ? "Active" : "Disabled"} />
                                                    <Row k="Last login" v={fmtDateTime(detail.owner.lastLoginAt)} />
                                                </dl>
                                                <div className="mt-3 flex items-center gap-2">
                                                    <button
                                                        onClick={() => openPwReset(detail.owner)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                                    >
                                                        <FiKey className="w-4 h-4" /> Reset owner password
                                                    </button>
                                                    <span className="text-[11px] text-gray-400">For support — set a new password and read it back to the owner.</span>
                                                </div>
                                            </>
                                        ) : <p className="text-sm text-gray-400">No owner record.</p>}
                                    </Section>

                                    <Section title="Store users" icon={FiUsers}>
                                        {users === null ? (
                                            <p className="text-sm text-gray-400">Loading…</p>
                                        ) : users.length === 0 ? (
                                            <p className="text-sm text-gray-400">No users yet.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {users.map((u) => (
                                                    <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-medium text-gray-800 flex items-center gap-1.5 flex-wrap">
                                                                @{u.username}
                                                                <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">{u.role}</span>
                                                                {u.isOwner && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 border border-indigo-100">OWNER</span>}
                                                                {u.isPlatformOwner && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 inline-flex items-center gap-0.5"><FiShield className="w-2.5 h-2.5" />PLATFORM</span>}
                                                                {!u.isActive && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">DISABLED</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-400 truncate">{u.email || "—"} · last login {fmtDateTime(u.lastLoginAt)}</div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button onClick={() => openPwReset(u)} title="Reset password" className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50">
                                                                <FiKey className="w-4 h-4" />
                                                            </button>
                                                            {!u.isPlatformOwner && (
                                                                <button onClick={() => toggleUser(u, detail.tenant._id)} title={u.isActive ? "Deactivate" : "Activate"} className={`p-2 rounded-lg ${u.isActive ? "text-orange-600 hover:bg-orange-50" : "text-emerald-600 hover:bg-emerald-50"}`}>
                                                                    {u.isActive ? <FiPause className="w-4 h-4" /> : <FiPlay className="w-4 h-4" />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </Section>

                                    {(detail.tenant.contact?.phone || detail.tenant.contact?.address) && (
                                        <Section title="Contact">
                                            <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
                                                <Row k="Phone" v={detail.tenant.contact?.phone || "—"} />
                                                <Row k="Address" v={detail.tenant.contact?.address || "—"} />
                                            </dl>
                                        </Section>
                                    )}

                                    {!detail.tenant.isPrimary && (
                                        <BillingPanel
                                            tenant={detail.tenant}
                                            plans={plans}
                                            flash={flash}
                                            onSaved={async () => { await openDetail(detail.tenant._id); load(); }}
                                        />
                                    )}

                                    <Section title="Data backup" icon={FiDatabase}>
                                        <p className="text-xs text-gray-500 mb-2">
                                            Download a full JSON backup of this store — categories, products, orders, customers,
                                            coupons, reviews and staff. Passwords and gateway secrets are never included.
                                        </p>
                                        <button
                                            onClick={() => downloadBackup(detail.tenant)}
                                            disabled={backupBusy}
                                            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-60"
                                        >
                                            {backupBusy
                                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                : <FiDownload className="w-4 h-4" />}
                                            Download backup
                                        </button>
                                    </Section>

                                    <Section title="Timeline" icon={FiClock}>
                                        <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
                                            <Row k="Registered" v={fmtDateTime(detail.tenant.createdAt)} />
                                            <Row k="Approved" v={fmtDateTime(detail.tenant.approvedAt)} />
                                            <Row k="Provisioned" v={fmtDateTime(detail.tenant.provisionedAt)} />
                                            <Row k="Suspended" v={fmtDateTime(detail.tenant.suspendedAt)} />
                                        </dl>
                                    </Section>

                                    {detail.tenant.notes && (
                                        <Section title="Internal notes">
                                            <p className="text-sm text-gray-600 whitespace-pre-wrap">{detail.tenant.notes}</p>
                                        </Section>
                                    )}
                                </div>

                                <div className="flex flex-wrap justify-end gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
                                    <ActionButtons t={detail.tenant} size="text" />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {pwTarget && (
                <PasswordSupportModal target={pwTarget} onClose={() => setPwTarget(null)} flash={flash} />
            )}
        </div>
    );
}

function Section({ title, icon: Icon, children }) {
    return (
        <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5">
                {Icon && <Icon className="w-3.5 h-3.5" />} {title}
            </p>
            {children}
        </div>
    );
}

function Row({ k, v }) {
    return (
        <>
            <dt className="text-gray-400 col-span-1">{k}</dt>
            <dd className="text-gray-800 col-span-2 break-words">{String(v)}</dd>
        </>
    );
}

// Support tool: set a NEW password for a store user and reveal it once so the
// platform owner can read it back to the store. Stored passwords are bcrypt
// hashes and can never be displayed — resetting is the only supported recovery.
function PasswordSupportModal({ target, onClose, flash }) {
    const [pw, setPw] = useState(() => genPassword());
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const copy = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            flash("success", `${label} copied`);
        } catch {
            flash("error", "Couldn't copy automatically — select the text and copy it.");
        }
    };

    const submit = async () => {
        if (!pw || pw.length < 8) {
            flash("error", "Password must be at least 8 characters.");
            return;
        }
        setBusy(true);
        try {
            const res = await resetAdminPassword(target.id, pw);
            if (!res?.success) throw new Error(res?.message || "Reset failed");
            setDone(true);
        } catch (e) {
            flash("error", e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !busy && onClose()}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <FiKey className="w-4 h-4 text-indigo-600" /> Reset password — @{target.username}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                </div>

                {!done ? (
                    <>
                        <div className="p-5 space-y-3">
                            <p className="text-sm text-gray-600">
                                Set a new password for this account and read it back to the store owner. For security, the
                                existing password is encrypted and can&apos;t be shown — resetting is the only way to recover access.
                            </p>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">New password</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        value={pw}
                                        onChange={(e) => setPw(e.target.value)}
                                        className="flex-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button onClick={() => setPw(genPassword())} title="Generate a new one" className="p-2.5 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200">
                                        <FiRotateCw className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">Editable — use the generated one or type a temporary password (min 8 characters).</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
                            <button onClick={onClose} disabled={busy} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button onClick={submit} disabled={busy} className="px-4 py-2.5 text-sm text-white font-medium rounded-xl inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
                                {busy && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                Set password
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-5 space-y-3">
                            <div className="flex items-center gap-2 text-emerald-700">
                                <FiCheckCircle className="w-5 h-5" />
                                <span className="font-semibold text-sm">New sign-in details</span>
                            </div>
                            <p className="text-sm text-gray-600">Share these with the store owner. The password won&apos;t be shown again.</p>
                            <CredRow label="Username" value={target.username} onCopy={() => copy(target.username, "Username")} />
                            <CredRow label="Password" value={pw} mono onCopy={() => copy(pw, "Password")} />
                        </div>
                        <div className="flex justify-end p-5 border-t border-gray-100">
                            <button onClick={onClose} className="px-4 py-2.5 text-sm text-white font-medium rounded-xl bg-gray-800 hover:bg-gray-900">Done</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function CredRow({ label, value, mono, onCopy }) {
    return (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
            <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
                <div className={`text-sm text-gray-900 truncate ${mono ? "font-mono" : ""}`}>{value}</div>
            </div>
            <button onClick={onCopy} title={`Copy ${label.toLowerCase()}`} className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg">
                <FiCopy className="w-3.5 h-3.5" /> Copy
            </button>
        </div>
    );
}

// Highlighted segmented-control class for the active billing status (static
// classes so Tailwind keeps them in the build).
const segCls = (active, key) => {
    if (!active) return "bg-white text-gray-600 border-gray-200 hover:border-gray-300";
    return {
        active: "bg-emerald-600 text-white border-emerald-600",
        past_due: "bg-amber-500 text-white border-amber-500",
        locked: "bg-red-600 text-white border-red-600",
    }[key];
};

const STATUS_OPTS = [
    { key: "active", label: "Active" },
    { key: "past_due", label: "Past due" },
    { key: "locked", label: "Locked" },
];

// Plan + billing controls for one store, inside the detail modal. Owns local
// draft state; calls back onSaved() (which reloads the detail + list) after a
// successful change so the saved values flow back in as fresh props.
function BillingPanel({ tenant, plans, flash, onSaved }) {
    const currentPlanId = tenant.planId ? String(tenant.planId) : "";
    const savedStatus = tenant.billing?.status || "active";
    const savedBalance = tenant.billing?.balanceDue ?? 0;
    const savedReason = tenant.billing?.lockedReason || "";

    const [planChoice, setPlanChoice] = useState(currentPlanId);
    const [status, setStatus] = useState(savedStatus);
    const [balanceDue, setBalanceDue] = useState(savedBalance);
    const [lockedReason, setLockedReason] = useState(savedReason);
    const [busyPlan, setBusyPlan] = useState(false);
    const [busyBilling, setBusyBilling] = useState(false);

    const planById = useMemo(() => {
        const m = {};
        plans.forEach((p) => { m[String(p._id)] = p; });
        return m;
    }, [plans]);
    const currentPlan = planById[currentPlanId];
    const currency = (planById[planChoice] || currentPlan)?.currency || "BDT";

    const planDirty = planChoice !== currentPlanId;
    const billingDirty =
        status !== savedStatus ||
        Number(balanceDue) !== Number(savedBalance) ||
        lockedReason !== savedReason;

    const savePlan = async () => {
        if (!planChoice) return;
        setBusyPlan(true);
        try {
            const res = await assignPlan(tenant._id, planChoice);
            if (!res?.success) throw new Error(res?.message || "Could not assign plan");
            flash("success", res.message || "Plan assigned.");
            await onSaved();
        } catch (e) {
            flash("error", e.message);
        } finally {
            setBusyPlan(false);
        }
    };

    const saveBilling = async () => {
        setBusyBilling(true);
        try {
            const payload = { status, balanceDue: Number(balanceDue) || 0 };
            if (status === "locked") payload.lockedReason = lockedReason;
            const res = await setBilling(tenant._id, payload);
            if (!res?.success) throw new Error(res?.message || "Could not update billing");
            flash("success", res.message || "Billing updated.");
            await onSaved();
        } catch (e) {
            flash("error", e.message);
        } finally {
            setBusyBilling(false);
        }
    };

    return (
        <Section title="Plan & billing" icon={FiCreditCard}>
            <div className="space-y-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">Plan</label>
                    {plans.length === 0 ? (
                        <p className="text-sm text-gray-400">
                            No plans yet — create one under <span className="font-medium text-gray-600">Plans</span> to assign it here.
                        </p>
                    ) : (
                        <div className="flex items-center gap-2">
                            <select
                                value={planChoice}
                                onChange={(e) => setPlanChoice(e.target.value)}
                                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">— No plan —</option>
                                {plans.map((p) => (
                                    <option key={p._id} value={String(p._id)}>
                                        {p.name} · {Number(p.price) > 0 ? `${p.price} ${p.currency}/${p.billingInterval}` : "Free"}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={savePlan}
                                disabled={!planDirty || !planChoice || busyPlan}
                                className="px-3 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                {busyPlan && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />} Assign
                            </button>
                        </div>
                    )}
                    {currentPlan && <p className="mt-1 text-[11px] text-gray-400">Current: {currentPlan.name}</p>}
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1">Billing status</label>
                    <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTS.map((o) => (
                            <button
                                key={o.key}
                                onClick={() => setStatus(o.key)}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${segCls(status === o.key, o.key)}`}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>
                    {status === "locked" && (
                        <p className="mt-1.5 text-[11px] text-red-500 flex items-center gap-1">
                            <FiLock className="w-3 h-3" /> Locking freezes the store owner&apos;s admin access.
                        </p>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Balance due ({currency})</label>
                        <input
                            type="number" min={0} value={balanceDue}
                            onChange={(e) => setBalanceDue(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Period sales</label>
                        <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm text-gray-600">{tenant.billing?.currentPeriodSales ?? 0}</div>
                    </div>
                </div>

                {status === "locked" && (
                    <div>
                        <label className="block text-xs text-gray-500 mb-1">Reason shown to the store</label>
                        <input
                            value={lockedReason} onChange={(e) => setLockedReason(e.target.value)} maxLength={300}
                            placeholder="e.g. Invoice #1024 unpaid"
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={saveBilling}
                        disabled={!billingDirty || busyBilling}
                        className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                        {busyBilling && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />} Save billing
                    </button>
                </div>
            </div>
        </Section>
    );
}
