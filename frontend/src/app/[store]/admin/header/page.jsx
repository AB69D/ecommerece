"use client";
import { authFetch } from "@/services/api";
import React, { useState, useEffect } from "react";
import { FiUploadCloud, FiTrash2, FiLink } from "react-icons/fi";

export default function CreateHeaderPage() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [headers, setHeaders] = useState([]);
    const [headersLoading, setHeadersLoading] = useState(true);

    useEffect(() => {
        fetchHeaders();
    }, []);

    const fetchHeaders = async () => {
        setHeadersLoading(true);
        try {
            const res = await authFetch(`/api/admin/header/get-headers`);
            const data = await res.json();
            if (data.success) {
                setHeaders(data.data);
            }
        } catch (error) {
            console.error("Failed to fetch headers:", error);
        } finally {
            setHeadersLoading(false);
        }
    };

    const handleHeaderSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const formData = new FormData(e.target);

        try {
            const res = await authFetch(`/api/admin/header/upload-header`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            
            if (data.success) {
                setMessage(`Success: ${data.message}`);
                e.target.reset();
                fetchHeaders();
            } else {
                setMessage(`Error: ${data.message}`);
            }
        } catch (error) {
            setMessage("Failed to submit. Please check your connection.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this header image?")) return;
        
        try {
            const res = await authFetch(`/api/admin/header/delete-header`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _id: id })
            });
            const data = await res.json();
            
            if (data.success) {
                setMessage("Header image deleted successfully");
                fetchHeaders();
            } else {
                setMessage(`Error: ${data.message}`);
            }
        } catch (error) {
            setMessage("Failed to delete header image.");
            console.error(error);
        }
    };

    return (
        <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Manage Header Images</h3>
            
            {message && (
                <div className={`p-4 mb-6 rounded-lg font-medium text-sm border ${
                    message.startsWith("Success") || message.includes("deleted") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                    {message}
                </div>
            )}

            {/* Upload Form */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Upload New Header</h4>
                <form onSubmit={handleHeaderSubmit} className="flex flex-col gap-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Redirect URL (Optional)</label>
                        <input type="text" name="url" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700" placeholder="e.g. /products/winter-sale" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image (Desktop/Mobile Banner)</label>
                        <div className="border border-dashed border-gray-300 rounded-lg p-6 bg-gray-50 text-center hover:bg-gray-100 transition cursor-pointer">
                            <input type="file" name="header_image" required accept="image/*" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
                        </div>
                    </div>
                    <button type="submit" disabled={loading} className="flex items-center justify-center gap-2 w-full bg-emerald-600 text-white font-medium py-3 rounded-lg shadow hover:bg-emerald-700 disabled:opacity-70 transition">
                        <FiUploadCloud className="w-5 h-5" /> {loading ? "Uploading..." : "Upload Header"}
                    </button>
                </form>
            </div>

            {/* Header Images List */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">All Header Images</h4>
                
                {headersLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                    </div>
                ) : headers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No header images uploaded yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {headers.map((header) => (
                        <div key={header._id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition">
                                 <div className="relative aspect-[2/1] bg-gray-100">
                                     <img 
                                         src={header.image} 
                                         alt="Header" 
                                         className="w-full h-full object-cover"
                                     />
                                 </div>
                                <div className="p-4">
                                    {header.url && (
                                        <div className="flex items-center gap-2 mb-3 text-sm text-emerald-600">
                                            <FiLink className="w-4 h-4" />
                                            <span className="truncate">{header.url}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-500">
                                            {new Date(header.createdAt).toLocaleDateString()}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(header._id)}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm"
                                        >
                                            <FiTrash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
