"use client";
import { useState } from "react";
import {
    FiUser, FiLock, FiCheck, FiAlertCircle, FiShield, FiEye, FiEyeOff,
} from "react-icons/fi";
import { changeOwnPassword } from "@/services/adminUsers";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ROLE_LABELS, ROLE_BADGE } from "@/lib/permissions";

export default function AccountPage() {
    const { me } = useAdminAuth();
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState({ type: "", text: "" });

    const submit = async (e) => {
        e.preventDefault();
        setMsg({ type: "", text: "" });
        if (next.length < 6) return setMsg({ type: "error", text: "New password must be at least 6 characters" });
        if (next !== confirm) return setMsg({ type: "error", text: "New passwords do not match" });
        setSaving(true);
        try {
            const res = await changeOwnPassword(current, next);
            if (res?.success) {
                setMsg({ type: "success", text: "Password changed successfully" });
                setCurrent(""); setNext(""); setConfirm("");
            } else {
                setMsg({ type: "error", text: res?.message || "Failed to change password" });
            }
        } catch {
            setMsg({ type: "error", text: "Network error. Please try again." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                <FiUser className="text-indigo-600" /> My Account
            </h1>

            <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-xl font-bold">
                        {(me?.fullName || me?.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-semibold text-gray-800">{me?.fullName || me?.username}</div>
                        <div className="text-sm text-gray-400">@{me?.username}{me?.email ? ` · ${me.email}` : ""}</div>
                        <span className={`inline-flex items-center gap-1 mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${ROLE_BADGE[me?.role] || ROLE_BADGE.viewer}`}>
                            <FiShield className="w-3 h-3" /> {ROLE_LABELS[me?.role] || me?.role}
                        </span>
                    </div>
                </div>
                {me?.effectivePermissions && !me.effectivePermissions.includes("*") && (
                    <div className="mt-4 text-xs text-gray-500">
                        <span className="font-medium text-gray-600">{me.effectivePermissions.length}</span> effective permissions
                    </div>
                )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FiLock className="w-5 h-5 text-indigo-600" /> Change password
                </h2>

                {msg.text && (
                    <div className={`mb-4 p-3 rounded-xl flex items-start gap-2 text-sm border ${msg.type === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                        {msg.type === "success" ? <FiCheck className="w-5 h-5 mt-0.5 shrink-0" /> : <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />}
                        <span>{msg.text}</span>
                    </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
                        <input type={show ? "text" : "password"} value={current} onChange={(e) => setCurrent(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                        <input type={show ? "text" : "password"} value={next} onChange={(e) => setNext(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-9 text-gray-400 hover:text-gray-600" tabIndex={-1}>
                            {show ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                        <input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required
                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button type="submit" disabled={saving}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2">
                        {saving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Update password"}
                    </button>
                </form>
            </div>
        </div>
    );
}
