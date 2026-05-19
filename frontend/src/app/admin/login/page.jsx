"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { FiMail, FiLock, FiArrowRight, FiCheckCircle, FiAlertCircle, FiSend } from "react-icons/fi";
import { sendLoginCode, verifyLoginCode, login } from "@/services/adminAuth";

export default function AdminLoginPage() {
    const router = useRouter();
    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSendCode = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        try {
            const result = await sendLoginCode(email);
            setLoading(false);

            if (result.success) {
                setStep('code');
                setMessage({ type: 'success', text: 'Login code sent to your email' });
            } else {
                setMessage({ type: 'error', text: result.message || 'Failed to send code' });
            }
        } catch (err) {
            setLoading(false);
            setMessage({ type: 'error', text: 'Network error. Could not connect to server.' });
        }
    };

    const handleVerifyCode = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        try {
            const result = await verifyLoginCode(email, code);
            setLoading(false);

            if (result.success) {
                login(result.data.token);
                router.push('/admin');
            } else {
                setMessage({ type: 'error', text: result.message || 'Invalid code' });
            }
        } catch (err) {
            setLoading(false);
            setMessage({ type: 'error', text: 'Network error. Could not connect to server.' });
        }
    };

    const handleResend = async () => {
        setCode('');
        setStep('email');
        setMessage({ type: '', text: '' });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                    <div className="text-center mb-8">
                        <div className="flex justify-center mb-4">
                            <Image
                                src="/logo.png"
                                alt="Ab9dEcommerce"
                                width={80}
                                height={80}
                                className="object-contain"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>
                        <p className="text-gray-500 mt-1 text-sm">
                            {step === 'email'
                                ? 'Enter your email to receive a login code'
                                : `Enter the 6-digit code sent to ${email}`
                            }
                        </p>
                    </div>

                    {message.text && (
                        <div className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm ${
                            message.type === 'success'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                            {message.type === 'success'
                                ? <FiCheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                : <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                            }
                            <span>{message.text}</span>
                        </div>
                    )}

                    {step === 'email' ? (
                        <form onSubmit={handleSendCode} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="admin@example.com"
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
                                        Send Code
                                        <FiSend className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyCode} className="space-y-5">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Login Code
                                </label>
                                <div className="relative">
                                    <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="000000"
                                        maxLength={6}
                                        required
                                        className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm tracking-[8px] text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all placeholder:text-gray-400"
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || code.length !== 6}
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        Verify & Login
                                        <FiArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={handleResend}
                                className="w-full text-sm text-gray-500 hover:text-emerald-600 transition-colors text-center"
                            >
                                Use a different email
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
