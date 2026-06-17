"use client";
import { useEffect, useState } from "react";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import AccountShell from "@/components/account/AccountShell";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { customerFetch } from "@/services/api";

function Banner({ tone, children }) {
    if (!children) return null;
    const ok = tone === "success";
    return (
        <div
            className={`mb-4 p-3 rounded-xl flex items-start gap-2.5 text-sm border ${
                ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
            }`}
        >
            {ok ? <FiCheckCircle className="w-5 h-5 shrink-0" /> : <FiAlertCircle className="w-5 h-5 shrink-0" />}
            <span>{children}</span>
        </div>
    );
}

const inputClass =
    "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400 disabled:bg-gray-100 disabled:text-gray-500";

function ProfileInner() {
    const { customer, refresh } = useCustomerAuth();

    const [profile, setProfile] = useState({ name: "", phone: "" });
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ tone: "", text: "" });

    const [pw, setPw] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState({ tone: "", text: "" });

    // Fetch profile on mount so fields are pre-filled even if auth context is stale
    useEffect(() => {
        customerFetch("/api/v1/client/auth/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.data) {
                    setProfile({ name: data.data.name || "", phone: data.data.phone || "" });
                }
            })
            .catch(() => {
                // Fall back to context data if the fetch fails
                if (customer) setProfile({ name: customer.name || "", phone: customer.phone || "" });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Keep form in sync when context updates (e.g. after save + refresh)
    useEffect(() => {
        if (customer) setProfile((prev) => ({ name: prev.name || customer.name || "", phone: prev.phone || customer.phone || "" }));
    }, [customer]);

    const saveProfile = async (e) => {
        e.preventDefault();
        setProfileMsg({ tone: "", text: "" });
        setSavingProfile(true);
        try {
            const res = await customerFetch("/api/v1/client/auth/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: profile.name.trim(), phone: profile.phone.trim() }),
            });
            const data = await res.json();
            setSavingProfile(false);
            if (data.success) {
                await refresh();
                setProfileMsg({ tone: "success", text: "Profile updated." });
            } else {
                setProfileMsg({ tone: "error", text: data.message || "Could not update profile." });
            }
        } catch {
            setSavingProfile(false);
            setProfileMsg({ tone: "error", text: "Network error. Please try again." });
        }
    };

    const changePassword = async (e) => {
        e.preventDefault();
        setPwMsg({ tone: "", text: "" });
        if (pw.newPassword.length < 8) {
            setPwMsg({ tone: "error", text: "New password must be at least 8 characters." });
            return;
        }
        if (pw.newPassword !== pw.confirmPassword) {
            setPwMsg({ tone: "error", text: "New password and confirm password do not match." });
            return;
        }
        setSavingPw(true);
        try {
            const res = await customerFetch("/api/v1/client/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword: pw.currentPassword, newPassword: pw.newPassword }),
            });
            const data = await res.json();
            setSavingPw(false);
            if (data.success) {
                setPw({ currentPassword: "", newPassword: "", confirmPassword: "" });
                setPwMsg({ tone: "success", text: "Password updated." });
            } else {
                setPwMsg({ tone: "error", text: data.message || "Could not update password." });
            }
        } catch {
            setSavingPw(false);
            setPwMsg({ tone: "error", text: "Network error. Please try again." });
        }
    };

    return (
        <div className="space-y-6">
            {/* Profile details */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Profile details</h2>
                <Banner tone={profileMsg.tone}>{profileMsg.text}</Banner>
                <form onSubmit={saveProfile} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                        <input
                            type="text"
                            value={profile.name}
                            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                        <input type="email" value={customer?.email || ""} disabled className={inputClass} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                        <input
                            type="tel"
                            value={profile.phone}
                            onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                            placeholder="01XXXXXXXXX"
                            className={inputClass}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={savingProfile}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        {savingProfile ? "Saving…" : "Save changes"}
                    </button>
                </form>
            </div>

            {/* Change password */}
            <div className="bg-white rounded-2xl ring-1 ring-gray-100 shadow-sm p-6">
                <h2 className="text-base font-semibold text-gray-900 mb-4">Change password</h2>
                <Banner tone={pwMsg.tone}>{pwMsg.text}</Banner>
                <form onSubmit={changePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Current password</label>
                        <input
                            type="password"
                            autoComplete="current-password"
                            value={pw.currentPassword}
                            onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))}
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={pw.newPassword}
                            onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))}
                            placeholder="At least 8 characters"
                            className={inputClass}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            value={pw.confirmPassword}
                            onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))}
                            placeholder="Re-enter new password"
                            className={inputClass}
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={savingPw}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                        {savingPw ? "Updating…" : "Update password"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default function AccountProfilePage() {
    return (
        <AccountShell title="My Account" subtitle="Manage your profile and password">
            <ProfileInner />
        </AccountShell>
    );
}
