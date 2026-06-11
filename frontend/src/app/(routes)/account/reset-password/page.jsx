"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FiLock, FiArrowRight, FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";
import { resetPassword as resetPasswordRequest } from "@/services/customerAuth";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

function ResetPasswordForm() {
    const router = useRouter();
    const params = useSearchParams();
    const token = params.get("token") || "";
    const { login } = useCustomerAuth();

    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }
        if (password !== confirm) {
            setError("Passwords do not match.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const result = await resetPasswordRequest({ token, password });
            setLoading(false);
            if (result.success && result.data?.token) {
                // Reset succeeded — the backend signed us straight in.
                login(result.data.token, result.data.customer);
                router.push("/account");
            } else {
                setError(result.message || "This password reset link is invalid or has expired.");
            }
        } catch {
            setLoading(false);
            setError("Network error. Could not connect to server.");
        }
    };

    // No token in the link — nothing to reset against.
    if (!token) {
        return (
            <div className="max-w-md mx-auto py-10 sm:py-16 px-4">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                        <FiAlertCircle className="w-7 h-7 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">Invalid reset link</h1>
                    <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                        This password reset link is missing or malformed. Please request a new one.
                    </p>
                    <Link
                        href="/account/forgot-password"
                        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                        Request a new link
                        <FiArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto py-10 sm:py-16 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Set a new password</h1>
                    <p className="text-gray-500 mt-1 text-sm">Choose a strong password you don&apos;t use elsewhere.</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm bg-red-50 text-red-700 border border-red-200">
                        <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
                        <div className="relative">
                            <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 8 characters"
                                required
                                autoFocus
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm new password</label>
                        <div className="relative">
                            <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                autoComplete="new-password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Re-enter your new password"
                                required
                                className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                            />
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
                                Reset password
                                <FiArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <p className="text-sm text-gray-500 text-center mt-6">
                    <Link href="/account/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
                        Back to sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense
            fallback={
                <div className="py-24 flex justify-center">
                    <div className="w-8 h-8 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            }
        >
            <ResetPasswordForm />
        </Suspense>
    );
}
