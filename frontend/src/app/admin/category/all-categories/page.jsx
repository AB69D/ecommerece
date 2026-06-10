"use client";
import { authFetch } from "@/services/api";
import React, { useState, useEffect } from "react";
import Image from "next/image";
import { FiEdit2, FiTrash2, FiX } from "react-icons/fi";
import { useAdminAuth } from "@/context/AdminAuthContext";

export default function AllCategoriesPage() {
    const { can } = useAdminAuth();
    const canWrite = can("category:write");
    const canDelete = can("category:delete");

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingCategory, setEditingCategory] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await authFetch(`/api/admin/category/get-all-category`);
            const data = await res.json();
            if (data.success) {
                setCategories(data.data);
            } else {
                setError(data.message || "Failed to load categories");
            }
        } catch (err) {
            setError("Network error. Could not connect to backend.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this category?")) return;

        setActionLoading(true);
        try {
            const res = await authFetch(`/api/admin/category/delete-category`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _id: id })
            });
            const data = await res.json();
            if (data.success) {
                setCategories(categories.filter(c => c._id !== id));
            } else {
                alert(`Error deleting: ${data.message}`);
            }
        } catch (err) {
            alert("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setActionLoading(true);

        const formData = new FormData(e.target);
        formData.append("_id", editingCategory._id);

        try {
            const res = await authFetch(`/api/admin/category/update-category`, {
                method: "PUT",
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                setCategories(categories.map(c => c._id === editingCategory._id ? data.data || { ...c, category_name: formData.get("category_name") } : c));
                setEditingCategory(null);
                fetchCategories();
            } else {
                alert(`Error updating: ${data.message}`);
            }
        } catch (err) {
            alert("Failed to submit.");
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div>
            <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 sm:mb-6">All Categories</h3>

            {loading && <p className="text-gray-500 text-sm">Loading categories...</p>}

            {error && <p className="text-red-500 bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200 text-xs sm:text-sm">{error}</p>}

            {!loading && !error && categories.length === 0 && (
                <p className="text-gray-500 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200 text-xs sm:text-sm">No categories found. Start by creating one.</p>
            )}

            {!loading && categories.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
                    {categories.map((category, index) => (
                        <div key={category._id || index} className="bg-white border flex flex-col text-gray-700 border-gray-200 rounded-lg sm:rounded-xl overflow-hidden shadow-sm hover:shadow-md transition">
                            <div className="h-28 sm:h-36 lg:h-40 w-full relative bg-gray-100 flex-shrink-0">
                                {category.category_image ? (
                                    <Image
                                        src={category.category_image}
                                        alt={category.category_name}
                                        fill
                                        style={{ objectFit: 'contain' }}
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs sm:text-sm">No Image</div>
                                )}
                            </div>
                            <div className="p-3 sm:p-4 border-t border-gray-100 flex-1 flex flex-col justify-between">
                                <h4 className="font-semibold text-sm sm:text-base lg:text-lg mb-3 sm:mb-4">{category.category_name}</h4>
                                <div className="flex items-center gap-2 mt-auto">
                                    {canWrite && (
                                        <button
                                            onClick={() => setEditingCategory(category)}
                                            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-xs sm:text-sm font-medium"
                                        >
                                            <FiEdit2 className="w-3 h-3 sm:w-4 sm:h-4" /> Edit
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            onClick={() => handleDelete(category._id)}
                                            disabled={actionLoading}
                                            className="flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-xs sm:text-sm font-medium disabled:opacity-50"
                                        >
                                            <FiTrash2 className="w-3 h-3 sm:w-4 sm:h-4" /> Delete
                                        </button>
                                    )}
                                    {!canWrite && !canDelete && (
                                        <span className="text-xs text-gray-400 py-1.5">View only</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {editingCategory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
                    <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100">
                            <h3 className="font-bold text-sm sm:text-lg">Edit Category</h3>
                            <button onClick={() => setEditingCategory(null)} className="p-1 hover:bg-gray-100 rounded text-gray-500">
                                <FiX className="w-4 h-4 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="p-4 sm:p-5 flex flex-col gap-3 sm:gap-4">
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Category Name</label>
                                <input
                                    type="text"
                                    name="category_name"
                                    defaultValue={editingCategory.category_name}
                                    required
                                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">Update Image (Optional)</label>
                                <input
                                    type="file"
                                    name="category_image"
                                    accept="image/*"
                                    className="w-full text-xs sm:text-sm text-gray-500 file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="mt-2 w-full bg-emerald-600 text-white font-medium py-2 sm:py-2.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-xs sm:text-sm"
                            >
                                {actionLoading ? "Saving..." : "Save Changes"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}