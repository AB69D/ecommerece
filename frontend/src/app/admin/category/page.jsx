"use client";
import { authFetch } from "@/services/api";
import React, { useState } from "react";
import { FiUploadCloud } from "react-icons/fi";

export default function CreateCategoryPage() {
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    const handleCategorySubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        const formData = new FormData(e.target);

        try {
            const res = await authFetch(`/api/admin/category/add-category`, {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            
            if (data.success) {
                setMessage(`Success: ${data.message}`);
                e.target.reset();
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

    return (
        <div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">Create Category</h3>
            
            {message && (
                <div className={`p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg font-medium text-xs sm:text-sm border ${
                    message.startsWith("Success") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                    {message}
                </div>
            )}

            <form onSubmit={handleCategorySubmit} className="flex flex-col gap-4 sm:gap-5">
                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Category Name</label>
                    <input 
                        type="text" 
                        name="category_name" 
                        required 
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition text-gray-700 text-sm" 
                        placeholder="e.g. Ghee & Oil" 
                    />
                </div>
                <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Category Image</label>
                    <div className="border border-dashed border-gray-300 rounded-lg p-4 sm:p-6 bg-gray-50 text-center hover:bg-gray-100 transition cursor-pointer">
                        <input 
                            type="file" 
                            name="category_image" 
                            required 
                            accept="image/*" 
                            className="w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" 
                        />
                    </div>
                </div>
                <button 
                    type="submit" 
                    disabled={loading} 
                    className="mt-2 sm:mt-4 flex items-center justify-center gap-2 w-full bg-emerald-600 text-white font-medium py-2.5 sm:py-3 rounded-lg shadow hover:bg-emerald-700 disabled:opacity-70 transition text-xs sm:text-sm"
                >
                    <FiUploadCloud className="w-4 h-4 sm:w-5 sm:h-5" /> {loading ? "Uploading..." : "Upload Category"}
                </button>
            </form>
        </div>
    );
}