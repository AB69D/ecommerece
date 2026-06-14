"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import Link from "@/components/StoreLink";
import { FiUser, FiMail, FiPhone, FiLock, FiArrowRight, FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";
import { register as registerRequest } from "@/services/customerAuth";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

function RegisterForm() {
    const router = useRouter();
    const params = useSearchParams();
    const nextUrl = params.get("next") || "/account";
    const { store = "" } = useParams() || {};
    const { login } = useCustomerAuth();

    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.name.trim()) return setError("Please enter your name.");
        if (!form.email.trim()) return setError("Please enter your email.");
        if (form.password.length < 8) return setError("Password must be at least 8 characters.");
        setError("");
        setLoading(true);
        try {
            const result = await registerRequest({
                name: form.name.trim(),
                email: form.email.trim(),
                phone: form.phone.trim(),
                password: form.password,
            }, store);
            setLoading(false);
            if (result.success && result.data?.token) {
                login(result.data.token, result.data.customer);
                router.push(nextUrl);
            } else {
                setError(result.message || "Could not create your account.");
            }
        } catch {
            setLoading(false);
            setError("Network error. Could not connect to server.");
        }
    };

    return (
        <div className="max-w-md mx-auto py-10 sm:py-16 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Create your account</h1>
                    <p className="text-gray-500 mt-1 text-sm">Save addresses, track orders & re-order in a tap</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm bg-red-50 text-red-700 border border-red-200">
                        <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
                        <div className="relative">
                            <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                autoComplete="name"
                                value={form.name}
                                onChange={set("name")}
                                placeholder="Jane Doe"
                                required
                                autoFocus
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                        <div className="relative">
                            <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                autoComplete="email"
                                value={form.email}
                                onChange={set("email")}
                                placeholder="you@example.com"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            Phone <span className="text-gray-400 font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                            <FiPhone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="tel"
                                autoComplete="tel"
                                value={form.phone}
                                onChange={set("phone")}
                                placeholder="01XXXXXXXXX"
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                        <div className="relative">
                            <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={form.password}
                                onChange={set("password")}
                                placeholder="At least 8 characters"
                                required
                                className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((s) => !s)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                tabIndex={-1}
                            >
                                {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Create account
                                <FiArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="text-sm text-gray-500 text-center mt-6">
                    Already have an account?{" "}
                    <Link
                        href={`/account/login${nextUrl !== "/account" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
                        className="font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function CustomerRegisterPage() {
    return (
        <Suspense
            fallback={
                <div className="py-24 flex justify-center">
                    <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            }
        >
            <RegisterForm />
        </Suspense>
    );
}
