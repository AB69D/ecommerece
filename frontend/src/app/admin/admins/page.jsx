"use client";
import { useState, useEffect } from "react";
import { authFetch } from "@/services/api";
import { FiUserPlus, FiTrash2, FiMail, FiShield, FiAlertCircle, FiCheckCircle } from "react-icons/fi";

export default function AdminsPage() {
    const [admins, setAdmins] = useState([]);
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });

    useEffect(() => {
        fetchAdmins();
    }, []);

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const res = await authFetch("/api/admin/admins/all");
            const data = await res.json();
            if (data.success) {
                setAdmins(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch admins:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setMessage({ type: "", text: "" });
        setSubmitting(true);
        try {
            const res = await authFetch("/api/admin/admins/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: "success", text: "Admin added successfully" });
                setEmail("");
                fetchAdmins();
            } else {
                setMessage({ type: "error", text: data.message });
            }
        } catch {
            setMessage({ type: "error", text: "Failed to add admin" });
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (id) => {
        if (!confirm("Are you sure you want to remove this admin?")) return;
        setMessage({ type: "", text: "" });
        try {
            const res = await authFetch(`/api/admin/admins/remove/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setMessage({ type: "success", text: "Admin removed successfully" });
                fetchAdmins();
            } else {
                setMessage({ type: "error", text: data.message });
            }
        } catch {
            setMessage({ type: "error", text: "Failed to remove admin" });
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-2xl font-bold text-gray-800">Admin Management</h3>
                <p className="text-gray-500 mt-1">Add or remove admin users</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-xl flex items-start gap-3 text-sm ${
                    message.type === "success"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                    {message.type === "success"
                        ? <FiCheckCircle className="w-5 h-5 mt-0.5 shrink-0" />
                        : <FiAlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                    }
                    <span>{message.text}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <FiUserPlus className="w-5 h-5 text-emerald-600" />
                    Add New Admin
                </h4>
                <form onSubmit={handleAdd} className="flex gap-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter admin email"
                        required
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-xl transition-all flex items-center gap-2"
                    >
                        {submitting ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>Add Admin <FiUserPlus className="w-4 h-4" /></>
                        )}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                    <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <FiShield className="w-5 h-5 text-indigo-600" />
                        Current Admins ({admins.length})
                    </h4>
                </div>
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                    </div>
                ) : admins.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FiShield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>No admins added yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {admins.map((admin) => (
                            <div key={admin._id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                                        <FiMail className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">{admin.email}</p>
                                        <p className="text-xs text-gray-400">
                                            Added {new Date(admin.createdAt).toLocaleDateString("en-GB")}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleRemove(admin._id)}
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    title="Remove admin"
                                >
                                    <FiTrash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
