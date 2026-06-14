"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { FiUser, FiLock, FiArrowRight, FiAlertCircle, FiEye, FiEyeOff, FiShoppingBag, FiSettings } from "react-icons/fi";
import { posLogin, setPosToken, posFetchMe, clearPosToken } from "@/services/pos";
import { hasPosAccess } from "./posPerms";

export default function PosLogin({ onLoggedIn }) {
    const { store } = useParams() || {};
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError("Username and password are required");
            return;
        }
        setError("");
        setLoading(true);
        try {
            const result = await posLogin(username.trim(), password);
            if (!result.success || !result.data?.token) {
                setLoading(false);
                setError(result.message || "Invalid credentials");
                return;
            }
            // Store the token, then confirm the account actually has POS access.
            setPosToken(result.data.token);
            const me = await posFetchMe();
            const perms = me?.data?.effectivePermissions || [];
            if (!me?.success || !hasPosAccess(perms)) {
                clearPosToken();
                setLoading(false);
                setError("This account does not have POS access.");
                return;
            }
            setLoading(false);
            onLoggedIn();
        } catch {
            setLoading(false);
            setError("Network error. Could not connect to server.");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 flex items-center justify-center p-4 overflow-y-auto">
            <div className="w-full max-w-md">
                <div className="bg-slate-900/70 backdrop-blur border border-slate-700/60 rounded-3xl shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                                <FiShoppingBag className="w-8 h-8 text-white" />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white">POS Terminal</h1>
                        <p className="text-slate-400 mt-1 text-sm">Sign in to start a sales session</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl flex items-start gap-3 text-sm bg-red-500/10 text-red-300 border border-red-500/30">
                            <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Username</label>
                            <div className="relative">
                                <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type="text"
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="cashier"
                                    required
                                    autoFocus
                                    className="w-full pl-11 pr-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all placeholder:text-slate-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
                            <div className="relative">
                                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full pl-11 pr-11 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all placeholder:text-slate-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((s) => !s)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
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
                            className="w-full py-3 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-60 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Start session
                                    <FiArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 flex flex-col items-center gap-3">
                        <a
                            href={`/${store}/admin`}
                            className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 transition-colors"
                        >
                            <FiSettings className="w-3.5 h-3.5" /> Go to Admin Panel
                        </a>
                        <p className="text-xs text-slate-500 text-center">
                            Need an account? Ask an administrator to add you as a POS seller.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
