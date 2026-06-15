"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FiTrash2, FiMail, FiUser, FiPhone, FiClock } from "react-icons/fi";
import { authFetch } from "@/services/api";

export default function AdminMessagesPage() {
    const { store = "" } = useParams() || {};
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const fetchMessages = async () => {
        try {
            const res = await authFetch(`/api/client/contact/messages`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.data);
            } else {
                setError(data.message || "Failed to fetch messages");
            }
        } catch (err) {
            setError("Failed to fetch messages");
        } finally {
            setLoading(false);
        }
    };

    const deleteMessage = async (id) => {
        if (!confirm("Are you sure you want to delete this message?")) return;

        try {
            const res = await authFetch(`/api/client/contact/delete/${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (data.success) {
                setMessages(messages.filter(msg => msg._id !== id));
            }
        } catch (err) {
            alert("Failed to delete message");
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 py-8 px-4">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-900 mb-8">Customer Messages</h1>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-12">
                        <p className="text-gray-500">Loading messages...</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
                        <p className="text-gray-500">No messages yet.</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {messages.map((msg) => (
                            <div key={msg._id} className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900">{msg.name}</h3>
                                        <div className="flex items-center gap-4 mt-2 text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <FiMail className="w-4 h-4" />
                                                <span className="text-sm">{msg.email}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <FiClock className="w-4 h-4" />
                                                <span className="text-sm">
                                                    {new Date(msg.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => deleteMessage(msg._id)}
                                        className="text-red-500 hover:text-red-700 transition-colors p-2"
                                        title="Delete message"
                                    >
                                        <FiTrash2 className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="mb-4">
                                    <h4 className="font-semibold text-gray-800 mb-1">Subject:</h4>
                                    <p className="text-gray-700">{msg.subject}</p>
                                </div>
                                
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-1">Message:</h4>
                                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
