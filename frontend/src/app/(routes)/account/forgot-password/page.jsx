"use client";
import { useState } from "react";
import Link from "next/link";
import { FiMail, FiArrowRight, FiAlertCircle, FiCheckCircle, FiArrowLeft } from "react-icons/fi";
import { requestPasswordReset } from "@/services/customerAuth";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const result = await requestPasswordReset({ email: email.trim() });
            setLoading(false);
            // The backend always returns a generic success (it never reveals
            // whether the email has an account), so we show the same confirmation
            // either way.
            if (result.success) {
                setSent(true);
            } else {
                setError(result.message || "Something went wrong. Please try again.");
            }
        } catch {
            setLoading(false);
            setError("Network error. Could not connect to server.");
        }
    };

    return (
        <div className="max-w-md mx-auto py-10 sm:py-16 px-4">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                {sent ? (
                    <div className="text-center">
                        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                            <FiCheckCircle className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">Check your email</h1>
                        <p className="text-gray-500 mt-2 text-sm leading-relaxed">
                            If an account exists for <span className="font-medium text-gray-700">{email.trim()}</span>,
                            we&apos;ve sent a link to reset your password. The link expires in 1 hour.
                        </p>
                        <p className="text-gray-400 mt-3 text-xs">
                            Didn&apos;t get it? Check your spam folder, or{" "}
                            <button
                                type="button"
                                onClick={() => setSent(false)}
                                className="font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                                try again
                            </button>
                            .
                        </p>
                        <Link
                            href="/account/login"
                            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
                        >
                            <FiArrowLeft className="w-4 h-4" />
                            Back to sign in
                        </Link>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-8">
                            <h1 className="text-2xl font-bold text-gray-800">Forgot your password?</h1>
                            <p className="text-gray-500 mt-1 text-sm">
                                Enter your email and we&apos;ll send you a reset link.
                            </p>
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

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Send reset link
                                        <FiArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <p className="text-sm text-gray-500 text-center mt-6">
                            Remember your password?{" "}
                            <Link
                                href="/account/login"
                                className="font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                                Sign in
                            </Link>
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
