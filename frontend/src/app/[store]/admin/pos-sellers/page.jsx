"use client";
import { useState, useEffect, useCallback } from "react";
import {
    FiPlus, FiUser, FiMail, FiKey, FiTrash2, FiExternalLink, FiX, FiAlertCircle,
    FiCheckCircle, FiSlash, FiShoppingBag, FiClock, FiEye, FiEyeOff,
} from "react-icons/fi";
import {
    listAdminUsers, createAdminUser, updateAdminUser, resetAdminPassword, deleteAdminUser,
} from "@/services/adminUsers";
import { useAdminAuth } from "@/context/AdminAuthContext";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Never");

export default function PosSellersPage() {
    const { can } = useAdminAuth();
    const canWrite = can("user:write");
    const canDelete = can("user:delete");

    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [banner, setBanner] = useState(null); // {type, text}
    const [showForm, setShowForm] = useState(false);
    const [resetFor, setResetFor] = useState(null); // seller obj
    const [busyId, setBusyId] = useState(null);

    const flash = (type, text) => {
        setBanner({ type, text });
        setTimeout(() => setBanner(null), 4000);
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await listAdminUsers();
            if (res?.success) {
                setSellers((res.data || []).filter((u) => u.role === "salesman"));
            }
        } catch {
            flash("error", "Failed to load sellers");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleActive = async (seller) => {
        setBusyId(seller._id);
        try {
            const res = await updateAdminUser(seller._id, { isActive: !seller.isActive });
            if (res?.success) {
                setSellers((prev) => prev.map((s) => (s._id === seller._id ? { ...s, isActive: !s.isActive } : s)));
            } else {
                flash("error", res?.message || "Update failed");
            }
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (seller) => {
        if (!window.confirm(`Remove POS seller "${seller.username}"? This cannot be undone.`)) return;
        setBusyId(seller._id);
        try {
            const res = await deleteAdminUser(seller._id);
            if (res?.success) {
                setSellers((prev) => prev.filter((s) => s._id !== seller._id));
                flash("success", "Seller removed");
            } else {
                flash("error", res?.message || "Delete failed");
            }
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiShoppingBag className="w-6 h-6 text-teal-600" /> POS Sellers
                    </h3>
                    <p className="text-gray-500 mt-1">
                        Cashier accounts that sign in at the in-store POS terminal.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <a
                        href="/pos"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
                    >
                        <FiExternalLink className="w-4 h-4" /> Open POS
                    </a>
                    {canWrite && (
                        <button
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium"
                        >
                            <FiPlus className="w-4 h-4" /> Add seller
                        </button>
                    )}
                </div>
            </div>

            {banner && (
                <div className={`p-3.5 rounded-xl flex items-center gap-2.5 text-sm border ${banner.type === "error" ? "bg-red-50 text-red-700 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                    {banner.type === "error" ? <FiAlertCircle className="w-5 h-5" /> : <FiCheckCircle className="w-5 h-5" />}
                    {banner.text}
                </div>
            )}

            {loading ? (
                <div className="h-48 flex items-center justify-center">
                    <div className="w-9 h-9 border-4 border-gray-200 border-t-teal-600 rounded-full animate-spin" />
                </div>
            ) : sellers.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-gray-200 rounded-2xl">
                    <FiShoppingBag className="w-14 h-14 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No POS sellers yet</p>
                    {canWrite && (
                        <button onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-medium">
                            <FiPlus className="w-4 h-4" /> Add your first seller
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {sellers.map((s) => (
                        <div key={s._id} className="bg-white border border-gray-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-semibold shrink-0">
                                    {(s.fullName || s.username || "?").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-gray-800 truncate">{s.fullName || s.username}</p>
                                    <p className="text-xs text-gray-400 flex items-center gap-1"><FiUser className="w-3 h-3" /> @{s.username}</p>
                                    {s.email && <p className="text-xs text-gray-400 flex items-center gap-1 truncate"><FiMail className="w-3 h-3" /> {s.email}</p>}
                                </div>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                    {s.isActive ? "Active" : "Disabled"}
                                </span>
                            </div>

                            <p className="text-[11px] text-gray-400 mt-3 flex items-center gap-1">
                                <FiClock className="w-3 h-3" /> Last login: {fmtDate(s.lastLoginAt)}
                            </p>

                            {(canWrite || canDelete) && (
                                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
                                    {canWrite && (
                                        <>
                                            <button
                                                onClick={() => setResetFor(s)}
                                                className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-teal-700 px-2 py-1.5 rounded-lg hover:bg-gray-50"
                                            >
                                                <FiKey className="w-3.5 h-3.5" /> Password
                                            </button>
                                            <button
                                                onClick={() => toggleActive(s)}
                                                disabled={busyId === s._id}
                                                className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-amber-700 px-2 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                            >
                                                {s.isActive ? <FiSlash className="w-3.5 h-3.5" /> : <FiCheckCircle className="w-3.5 h-3.5" />}
                                                {s.isActive ? "Disable" : "Enable"}
                                            </button>
                                        </>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => remove(s)}
                                            disabled={busyId === s._id}
                                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 ml-auto disabled:opacity-50"
                                        >
                                            <FiTrash2 className="w-3.5 h-3.5" /> Remove
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showForm && (
                <SellerFormModal
                    onClose={() => setShowForm(false)}
                    onCreated={(msg) => { setShowForm(false); flash("success", msg); load(); }}
                    onError={(msg) => flash("error", msg)}
                />
            )}

            {resetFor && (
                <ResetPasswordModal
                    seller={resetFor}
                    onClose={() => setResetFor(null)}
                    onDone={(msg) => { setResetFor(null); flash("success", msg); }}
                    onError={(msg) => flash("error", msg)}
                />
            )}
        </div>
    );
}

function SellerFormModal({ onClose, onCreated, onError }) {
    const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "" });
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const submit = async (e) => {
        e.preventDefault();
        if (!form.username || form.password.length < 6) {
            onError("Username and a 6+ character password are required");
            return;
        }
        setSubmitting(true);
        try {
            const res = await createAdminUser({
                username: form.username.trim().toLowerCase(),
                password: form.password,
                fullName: form.fullName.trim(),
                email: form.email.trim(),
                role: "salesman",
            });
            if (res?.success) {
                onCreated(`POS seller "${form.username.trim().toLowerCase()}" created`);
            } else {
                onError(res?.message || "Could not create seller");
                setSubmitting(false);
            }
        } catch {
            onError("Network error creating seller");
            setSubmitting(false);
        }
    };

    return (
        <Modal onClose={onClose} title="Add POS seller" icon={<FiShoppingBag className="w-5 h-5 text-teal-600" />}>
            <form onSubmit={submit} className="space-y-4">
                <Field label="Full name">
                    <input value={form.fullName} onChange={set("fullName")} placeholder="Jane Cashier" className={inputCls} />
                </Field>
                <Field label="Username *">
                    <input value={form.username} onChange={set("username")} placeholder="jane" required className={inputCls} />
                </Field>
                <Field label="Email (optional)">
                    <input type="email" value={form.email} onChange={set("email")} placeholder="jane@store.com" className={inputCls} />
                </Field>
                <Field label="Password *">
                    <div className="relative">
                        <input
                            type={showPw ? "text" : "password"}
                            value={form.password}
                            onChange={set("password")}
                            placeholder="At least 6 characters"
                            required
                            className={`${inputCls} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                            {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                    </div>
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-60 inline-flex items-center gap-2">
                        {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Create seller
                    </button>
                </div>
            </form>
        </Modal>
    );
}

function ResetPasswordModal({ seller, onClose, onDone, onError }) {
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        if (password.length < 6) { onError("Password must be at least 6 characters"); return; }
        setSubmitting(true);
        try {
            const res = await resetAdminPassword(seller._id, password);
            if (res?.success) onDone(`Password reset for "${seller.username}"`);
            else { onError(res?.message || "Reset failed"); setSubmitting(false); }
        } catch {
            onError("Network error"); setSubmitting(false);
        }
    };

    return (
        <Modal onClose={onClose} title={`Reset password — @${seller.username}`} icon={<FiKey className="w-5 h-5 text-teal-600" />}>
            <form onSubmit={submit} className="space-y-4">
                <Field label="New password *">
                    <div className="relative">
                        <input
                            type={showPw ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            required
                            autoFocus
                            className={`${inputCls} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" tabIndex={-1}>
                            {showPw ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                        </button>
                    </div>
                </Field>
                <div className="flex items-center justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100">Cancel</button>
                    <button type="submit" disabled={submitting} className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium disabled:opacity-60 inline-flex items-center gap-2">
                        {submitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        Reset password
                    </button>
                </div>
            </form>
        </Modal>
    );
}

const inputCls = "w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent";

function Field({ label, children }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
            {children}
        </div>
    );
}

function Modal({ title, icon, onClose, children }) {
    return (
        // Bottom-sheet on phones (easy thumb reach, survives the on-screen
        // keyboard), centered dialog on >= sm. Panel is height-capped and
        // scrollable so the action buttons are never pushed off-screen.
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md max-h-[90dvh] flex flex-col">
                <div className="sticky top-0 bg-white flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-3 rounded-t-2xl">
                    <h4 className="font-bold text-gray-800 flex items-center gap-2">{icon} {title}</h4>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600"><FiX className="w-5 h-5" /></button>
                </div>
                <div className="px-5 sm:px-6 pb-6 overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
}
