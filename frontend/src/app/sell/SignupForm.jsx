"use client";

import { useState } from "react";
import Link from "next/link";
import {
    FiBriefcase, FiGlobe, FiUser, FiMail, FiAtSign, FiLock,
    FiEye, FiEyeOff, FiPhone, FiMapPin, FiCheckCircle, FiArrowRight,
} from "react-icons/fi";
import { registerStore } from "@/services/platform";

// Mirror the backend validators (platform.controller.js) so the user gets
// instant feedback instead of a round-trip 400.
const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const USERNAME_RE = /^[a-z0-9._-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Keep input clean as the user types: a subdomain is a DNS label, a username is
// the GLOBAL login identity — both are lowercase and a restricted charset.
const cleanSubdomain = (v) => v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 63);
const cleanUsername = (v) => v.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 64);

const initialForm = {
    businessName: "",
    subdomain: "",
    fullName: "",
    email: "",
    username: "",
    password: "",
    phone: "",
    address: "",
};

export default function SignupForm() {
    const [form, setForm] = useState(initialForm);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(null); // { subdomain } on success

    const set = (name, value) => setForm((f) => ({ ...f, [name]: value }));

    const onChange = (e) => {
        const { name, value } = e.target;
        if (name === "subdomain") return set(name, cleanSubdomain(value));
        if (name === "username") return set(name, cleanUsername(value));
        set(name, value);
    };

    const validate = () => {
        const businessName = form.businessName.trim();
        if (businessName.length < 2 || businessName.length > 100)
            return "Business name must be 2–100 characters.";
        if (form.subdomain.length < 2 || form.subdomain.length > 63 || !SUBDOMAIN_RE.test(form.subdomain))
            return "Store address must be 2–63 chars: letters, numbers and hyphens only.";
        if (!EMAIL_RE.test(form.email.trim()))
            return "Please enter a valid email address.";
        if (form.username.length < 3 || form.username.length > 64 || !USERNAME_RE.test(form.username))
            return "Username must be 3–64 chars: letters, numbers, dot, underscore or hyphen.";
        if (form.password.length < 8)
            return "Password must be at least 8 characters.";
        return "";
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const msg = validate();
        if (msg) { setError(msg); return; }

        setLoading(true);
        setError("");
        try {
            const payload = {
                businessName: form.businessName.trim(),
                subdomain: form.subdomain,
                owner: {
                    fullName: form.fullName.trim(),
                    email: form.email.trim(),
                    username: form.username,
                    password: form.password,
                },
                contact: { phone: form.phone.trim(), address: form.address.trim() },
            };
            const res = await registerStore(payload);
            if (res?.success) {
                setDone({ subdomain: res.data?.subdomain || form.subdomain });
                setForm(initialForm);
            } else {
                setError(res?.message || "Registration failed. Please try again.");
            }
        } catch {
            setError("Could not reach the server. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
                    <FiCheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Registration received</h2>
                <p className="text-gray-600 leading-relaxed max-w-md mx-auto">
                    Your store <span className="font-semibold text-gray-900">{done.subdomain}</span> is
                    now <span className="font-semibold">pending approval</span>. We&apos;ll email you as
                    soon as it&apos;s live — then you can sign in with your username and start setting up
                    your products and storefront.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                    <Link
                        href="/login"
                        className="inline-flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
                    >
                        Go to sign in <FiArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                        Back to home
                    </Link>
                </div>
            </div>
        );
    }

    const inputClass =
        "w-full pl-11 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all";
    const iconClass = "absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4";

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Open your store</h2>
            <p className="text-sm text-gray-500 mb-6">
                Tell us about your business. We review every signup and email you when your store is live.
            </p>

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-800 text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* ── Business ─────────────────────────────────────────────── */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Business name</label>
                    <div className="relative">
                        <FiBriefcase className={iconClass} />
                        <input
                            type="text" name="businessName" value={form.businessName}
                            onChange={onChange} required maxLength={100}
                            className={inputClass} placeholder="Acme Supplies"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Store address</label>
                    <div className="relative">
                        <FiGlobe className={iconClass} />
                        <input
                            type="text" name="subdomain" value={form.subdomain}
                            onChange={onChange} required minLength={2} maxLength={63}
                            className={inputClass} placeholder="acme" autoCapitalize="none" spellCheck={false}
                        />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">
                        Your unique store address (letters, numbers, hyphens). Custom store links go live
                        later — this reserves yours now.
                    </p>
                </div>

                {/* ── Owner account ────────────────────────────────────────── */}
                <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 mt-4">
                        Owner account
                    </p>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Full name</label>
                            <div className="relative">
                                <FiUser className={iconClass} />
                                <input
                                    type="text" name="fullName" value={form.fullName}
                                    onChange={onChange} className={inputClass} placeholder="Jane Doe"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <div className="relative">
                                <FiMail className={iconClass} />
                                <input
                                    type="email" name="email" value={form.email}
                                    onChange={onChange} required className={inputClass}
                                    placeholder="you@business.com" autoCapitalize="none" spellCheck={false}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                            <div className="relative">
                                <FiAtSign className={iconClass} />
                                <input
                                    type="text" name="username" value={form.username}
                                    onChange={onChange} required minLength={3} maxLength={64}
                                    className={inputClass} placeholder="jane.doe"
                                    autoCapitalize="none" spellCheck={false}
                                />
                            </div>
                            <p className="mt-1.5 text-xs text-gray-400">
                                This is how you&apos;ll sign in. It must be unique across the whole platform.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                            <div className="relative">
                                <FiLock className={iconClass} />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password" value={form.password}
                                    onChange={onChange} required minLength={8}
                                    className={`${inputClass} pr-11`} placeholder="At least 8 characters"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Contact (optional) ───────────────────────────────────── */}
                <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4 mt-4">
                        Contact <span className="font-normal normal-case">(optional)</span>
                    </p>
                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                            <div className="relative">
                                <FiPhone className={iconClass} />
                                <input
                                    type="tel" name="phone" value={form.phone}
                                    onChange={onChange} className={inputClass} placeholder="+1 555 123 4567"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                            <div className="relative">
                                <FiMapPin className={iconClass} />
                                <input
                                    type="text" name="address" value={form.address}
                                    onChange={onChange} className={inputClass} placeholder="City, Country"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? "Submitting…" : "Create my store"}
                </button>

                <p className="text-center text-sm text-gray-500">
                    Already have a store?{" "}
                    <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
                        Sign in
                    </Link>
                </p>
            </form>
        </div>
    );
}
