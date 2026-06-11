"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiUser, FiLock, FiArrowRight, FiAlertCircle, FiEye, FiEyeOff, FiShield, FiGrid } from "react-icons/fi";
import { loginWithPassword, login } from "@/services/adminAuth";

// Shared sign-in used by the platform-owner login (/) and the global store-owner
// login (/login). Same mechanism either way — the destination is decided by the
// account, not the page: platform owners land on /platform, store owners on
// /<store>/admin. The `variant` only changes the copy.
export default function AdminSignIn({ variant = "store" }) {
    const router = useRouter();
    const platform = variant === "platform";
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setMessage({ type: "error", text: "Username and password are required" });
            return;
        }
        setMessage({ type: "", text: "" });
        setLoading(true);
        try {
            const result = await loginWithPassword(username.trim(), password);
            if (result.success && result.data?.token) {
                login(result.data.token);
                const { isPlatformOwner, store } = result.data;
                if (isPlatformOwner) {
                    router.push("/platform");
                } else if (store) {
                    router.push(`/${store}/admin`);
                } else {
                    setLoading(false);
                    setMessage({ type: "error", text: "Your account isn't linked to a store yet. Contact the platform owner." });
                }
            } else {
                setLoading(false);
                setMessage({ type: "error", text: result.message || "Invalid credentials" });
            }
        } catch {
            setLoading(false);
            setMessage({ type: "error", text: "Network error. Could not connect to server." });
        }
    };

    const Icon = platform ? FiShield : FiGrid;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    <div className="text-center mb-8">
                        <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg mb-4">
                            <Icon className="w-7 h-7 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {platform ? "Platform sign in" : "Sign in to your store"}
                        </h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            {platform
                                ? "Owner access to the whole platform."
                                : "Use your owner credentials — we'll take you to your store."}
                        </p>
                    </div>

                    {message.text && (
                        <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm bg-red-50 text-red-700 border border-red-200">
                            <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <span>{message.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                            <div className="relative">
                                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type="text" autoComplete="username" value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="yourname" required autoFocus autoCapitalize="none" spellCheck={false}
                                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                            <div className="relative">
                                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? "text" : "password"} autoComplete="current-password" value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••" required
                                    className="w-full pl-11 pr-11 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-400"
                                />
                                <button
                                    type="button" onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    aria-label={showPassword ? "Hide password" : "Show password"} tabIndex={-1}
                                >
                                    {showPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit" disabled={loading}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Sign in <FiArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="text-xs text-gray-400 text-center mt-6">
                        {platform ? (
                            <>Not a platform owner? <Link href="/login" className="text-indigo-600 hover:underline font-medium">Store sign in</Link></>
                        ) : (
                            <>Want your own store? <Link href="/sell" className="text-indigo-600 hover:underline font-medium">Open one here</Link></>
                        )}
                    </p>
                </div>
            </div>
        </div>
    );
}
