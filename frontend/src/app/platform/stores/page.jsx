"use client";
import { useEffect, useMemo, useState } from "react";
import {
    FiGlobe, FiCheck, FiX, FiAlertCircle, FiSlash, FiPause, FiPlay,
    FiEye, FiRefreshCw, FiClock, FiUser, FiExternalLink,
} from "react-icons/fi";
import {
    listTenants, getTenant, approveTenant, suspendTenant, rejectTenant,
} from "@/services/platform";
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
        try {
            const res = await getTenant(id);
            if (res?.success) setDetail(res.data);
            else { flash("error", res?.message || "Failed to load store"); setDetail(null); }
        } catch {
            flash("error", "Could not load store details.");
            setDetail(null);
        } finally {
            setDetailLoading(false);
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
                                            <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
                                                <Row k="Name" v={detail.owner.fullName || "—"} />
                                                <Row k="Username" v={`@${detail.owner.username}`} />
                                                <Row k="Email" v={detail.owner.email || "—"} />
                                                <Row k="Login" v={detail.owner.isActive ? "Active" : "Disabled"} />
                                                <Row k="Last login" v={fmtDateTime(detail.owner.lastLoginAt)} />
                                            </dl>
                                        ) : <p className="text-sm text-gray-400">No owner record.</p>}
                                    </Section>

                                    {(detail.tenant.contact?.phone || detail.tenant.contact?.address) && (
                                        <Section title="Contact">
                                            <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
                                                <Row k="Phone" v={detail.tenant.contact?.phone || "—"} />
                                                <Row k="Address" v={detail.tenant.contact?.address || "—"} />
                                            </dl>
                                        </Section>
                                    )}

                                    <Section title="Billing">
                                        <dl className="grid grid-cols-3 gap-y-1.5 text-sm">
                                            <Row k="Status" v={detail.tenant.billing?.status || "active"} />
                                            <Row k="Period sales" v={detail.tenant.billing?.currentPeriodSales ?? 0} />
                                            <Row k="Balance due" v={detail.tenant.billing?.balanceDue ?? 0} />
                                        </dl>
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
