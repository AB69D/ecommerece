"use client";
import { useEffect, useMemo, useState } from "react";
import {
    FiUserPlus, FiEdit2, FiTrash2, FiKey, FiX, FiCheck, FiAlertCircle,
    FiShield, FiSearch, FiSlash,
} from "react-icons/fi";
import {
    listAdminUsers, createAdminUser, updateAdminUser,
    resetAdminPassword, deleteAdminUser,
} from "@/services/adminUsers";
import { getRbacCatalog } from "@/services/rbac";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ROLE_LABELS, ROLE_BADGE } from "@/lib/permissions";

const roleGrants = (role, rolePermissions, perm) => {
    const list = rolePermissions?.[role] || [];
    if (list.includes("*")) return true;
    if (list.includes(perm)) return true;
    return list.includes(`${perm.split(":")[0]}:*`);
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

function PermissionMatrix({ catalog, role, selected, onToggle }) {
    if (!catalog?.groups) return null;
    return (
        <div className="space-y-4 max-h-72 overflow-y-auto pr-1 border border-gray-100 rounded-xl p-3 bg-gray-50">
            <p className="text-xs text-gray-500">
                Greyed/checked = granted automatically by the <strong>{ROLE_LABELS[role] || role}</strong> role.
                Tick extra boxes to grant additional permissions beyond the role.
            </p>
            {catalog.groups.map((group) => (
                <div key={group.key}>
                    <p className="text-xs font-semibold text-gray-700 mb-1.5">{group.label}</p>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
                        {group.resources.flatMap((r) =>
                            r.actions.map((a) => {
                                const perm = `${r.key}:${a}`;
                                const viaRole = roleGrants(role, catalog.rolePermissions, perm);
                                const checked = viaRole || selected.includes(perm);
                                return (
                                    <label key={perm} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1 ${viaRole ? "text-gray-400" : "text-gray-700 hover:bg-white"}`}>
                                        <input
                                            type="checkbox"
                                            disabled={viaRole}
                                            checked={checked}
                                            onChange={() => onToggle(perm)}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span>{r.label} <span className="text-gray-400">· {a}</span></span>
                                    </label>
                                );
                            }),
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

const emptyForm = { username: "", password: "", fullName: "", email: "", role: "admin", permissions: [], isActive: true };

export default function UsersRolesPage() {
    const { can, me } = useAdminAuth();
    const [users, setUsers] = useState([]);
    const [catalog, setCatalog] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: "", text: "" });
    const [search, setSearch] = useState("");

    const [modal, setModal] = useState(null); // { mode, user }
    const [form, setForm] = useState(emptyForm);
    const [resetPwd, setResetPwd] = useState("");
    const [saving, setSaving] = useState(false);

    const canWrite = can("user:write");
    const canDelete = can("user:delete");

    const load = async () => {
        setLoading(true);
        const [u, c] = await Promise.all([listAdminUsers(), getRbacCatalog()]);
        if (u?.success) setUsers(u.data || []);
        if (c?.success) setCatalog(c.data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter((u) =>
            [u.username, u.fullName, u.email, u.role].filter(Boolean).some((v) => v.toLowerCase().includes(q)),
        );
    }, [users, search]);

    const openCreate = () => { setForm(emptyForm); setModal({ mode: "create" }); };
    const openEdit = (u) => {
        setForm({
            username: u.username, password: "", fullName: u.fullName || "",
            email: u.email || "", role: u.role, permissions: u.permissions || [], isActive: u.isActive,
        });
        setModal({ mode: "edit", user: u });
    };
    const openReset = (u) => { setResetPwd(""); setModal({ mode: "reset", user: u }); };

    const togglePerm = (perm) =>
        setForm((f) => ({
            ...f,
            permissions: f.permissions.includes(perm)
                ? f.permissions.filter((p) => p !== perm)
                : [...f.permissions, perm],
        }));

    const flash = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: "", text: "" }), 4000); };

    const submit = async () => {
        setSaving(true);
        try {
            if (modal.mode === "create") {
                const res = await createAdminUser(form);
                if (!res?.success) throw new Error(res?.message || "Failed to create user");
                flash("success", `User "${form.username}" created`);
            } else if (modal.mode === "edit") {
                const payload = {
                    fullName: form.fullName, email: form.email, role: form.role,
                    permissions: form.permissions, isActive: form.isActive,
                };
                const res = await updateAdminUser(modal.user._id, payload);
                if (!res?.success) throw new Error(res?.message || "Failed to update user");
                flash("success", `User "${modal.user.username}" updated`);
            } else if (modal.mode === "reset") {
                const res = await resetAdminPassword(modal.user._id, resetPwd);
                if (!res?.success) throw new Error(res?.message || "Failed to reset password");
                flash("success", `Password reset for "${modal.user.username}"`);
            }
            setModal(null);
            await load();
        } catch (e) {
            flash("error", e.message);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (u) => {
        if (!confirm(`Delete admin user "${u.username}"? This cannot be undone.`)) return;
        const res = await deleteAdminUser(u._id);
        if (res?.success) { flash("success", `Deleted "${u.username}"`); load(); }
        else flash("error", res?.message || "Failed to delete user");
    };

    if (loading) {
        return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin" /></div>;
    }

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FiShield className="text-indigo-600" /> Users & Roles
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage admin accounts, roles and fine-grained permissions.</p>
                </div>
                {canWrite && (
                    <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors">
                        <FiUserPlus className="w-4 h-4" /> Add User
                    </button>
                )}
            </div>

            <Banner msg={msg} onClose={() => setMsg({ type: "", text: "" })} />

            <div className="relative mb-4 max-w-sm">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                            <th className="text-left font-semibold px-4 py-3">User</th>
                            <th className="text-left font-semibold px-4 py-3">Role</th>
                            <th className="text-left font-semibold px-4 py-3">Status</th>
                            <th className="text-left font-semibold px-4 py-3 hidden md:table-cell">Last login</th>
                            <th className="text-right font-semibold px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filtered.map((u) => {
                            const isMe = me?.id === u._id;
                            return (
                                <tr key={u._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800">{u.fullName || u.username}</div>
                                        <div className="text-xs text-gray-400">@{u.username}{u.email ? ` · ${u.email}` : ""}{isMe ? " · you" : ""}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full border ${ROLE_BADGE[u.role] || ROLE_BADGE.viewer}`}>
                                            {ROLE_LABELS[u.role] || u.role}
                                        </span>
                                        {u.permissions?.length > 0 && (
                                            <span className="ml-1 text-[10px] text-gray-400">+{u.permissions.length}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {u.isActive
                                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><FiCheck className="w-3.5 h-3.5" /> Active</span>
                                            : <span className="inline-flex items-center gap-1 text-xs text-gray-400"><FiSlash className="w-3.5 h-3.5" /> Disabled</span>}
                                    </td>
                                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">
                                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            {canWrite && (
                                                <>
                                                    <button onClick={() => openEdit(u)} title="Edit" className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><FiEdit2 className="w-4 h-4" /></button>
                                                    <button onClick={() => openReset(u)} title="Reset password" className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><FiKey className="w-4 h-4" /></button>
                                                </>
                                            )}
                                            {canDelete && !isMe && (
                                                <button onClick={() => remove(u)} title="Delete" className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><FiTrash2 className="w-4 h-4" /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filtered.length === 0 && (
                            <tr><td colSpan={5} className="text-center text-gray-400 py-10">No users found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {modal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => !saving && setModal(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
                            <h2 className="font-bold text-gray-800">
                                {modal.mode === "create" ? "Add User" : modal.mode === "edit" ? `Edit @${modal.user.username}` : `Reset password · @${modal.user.username}`}
                            </h2>
                            <button onClick={() => setModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><FiX className="w-5 h-5 text-gray-500" /></button>
                        </div>

                        <div className="p-5 space-y-4">
                            {modal.mode === "reset" ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                                    <input type="text" value={resetPwd} onChange={(e) => setResetPwd(e.target.value)} placeholder="At least 6 characters"
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            ) : (
                                <>
                                    {modal.mode === "create" && (
                                        <div className="grid sm:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Username *</label>
                                                <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="jane.doe"
                                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                                                <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters"
                                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                                            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Jane Doe"
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com"
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                        </div>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-3 items-end">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                                            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                                                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                                {(catalog?.roles || []).map((r) => (
                                                    <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        {modal.mode === "edit" && (
                                            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2.5">
                                                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                Account active
                                            </label>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Extra permissions</label>
                                        <PermissionMatrix catalog={catalog} role={form.role} selected={form.permissions} onToggle={togglePerm} />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 sticky bottom-0 bg-white">
                            <button onClick={() => setModal(null)} disabled={saving} className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                            <button onClick={submit} disabled={saving} className="px-4 py-2.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl inline-flex items-center gap-2">
                                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {modal.mode === "create" ? "Create user" : modal.mode === "edit" ? "Save changes" : "Reset password"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
