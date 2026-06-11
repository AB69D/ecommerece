"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FiMail, FiLock, FiArrowRight, FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";
import { login as loginRequest } from "@/services/customerAuth";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const nextUrl = params.get("next") || "/account";
    const { login } = useCustomerAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            setError("Email and password are required.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const result = await loginRequest({ email: email.trim(), password });
            setLoading(false);
            if (result.success && result.data?.token) {
                login(result.data.token, result.data.customer);
                router.push(nextUrl);
            } else {
                setError(result.message || "Invalid email or password.");
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
                    <h1 className="text-2xl font-bold text-gray-800">Welcome back</h1>
                    <p className="text-gray-500 mt-1 text-sm">Sign in to your account</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm bg-red-50 text-red-700 border border-red-200">
                        <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                        <div className="relative">
                            <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                autoFocus
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
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
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
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                Sign in
                                <FiArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="text-sm text-gray-500 text-center mt-6">
                    Don&apos;t have an account?{" "}
                    <Link
                        href={`/account/register${nextUrl !== "/account" ? `?next=${encodeURIComponent(nextUrl)}` : ""}`}
                        className="font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function CustomerLoginPage() {
    return (
        <Suspense
            fallback={
                <div className="py-24 flex justify-center">
                    <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
