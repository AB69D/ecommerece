"use client";
import { authFetch } from "@/services/api";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FiEdit, FiTrash2, FiPlus, FiSearch, FiX, FiImage } from "react-icons/fi";

export default function GheeOilAdminPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [deleteModal, setDeleteModal] = useState({ show: false, product: null });
    const [message, setMessage] = useState("");
    const [categoryId, setCategoryId] = useState("");

    useEffect(() => {
        fetchGheeOilCategory();
    }, []);

    const fetchGheeOilCategory = async () => {
        try {
            const res = await authFetch(`/api/admin/category/get-all-category`);
            const data = await res.json();
            if (data.success) {
                const gheeCategory = data.data.find(cat => 
                    cat.category_name.includes("ঘি") || cat.category_name.toLowerCase().includes("ghee")
                );
                if (gheeCategory) {
                    setCategoryId(gheeCategory._id);
                    fetchProducts(gheeCategory._id);
                } else {
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error("Failed to fetch category:", error);
            setLoading(false);
        }
    };

    const fetchProducts = async (catId) => {
        setLoading(true);
        try {
            const res = await authFetch(`/api/admin/product/get-all-product`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ page: 1, limit: 100, search })
            });
            const data = await res.json();
            if (data.success) {
                const filtered = data.data.filter(p => p.category?._id === catId || p.category === catId);
                setProducts(filtered);
            }
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModal.product) return;

        try {
            const res = await authFetch(`/api/admin/product/delete-product`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ _id: deleteModal.product._id })
            });
            const data = await res.json();

            if (data.success) {
                setMessage("Product deleted successfully");
                setProducts(products.filter(p => p._id !== deleteModal.product._id));
            } else {
                setMessage("Failed to delete product");
            }
        } catch (error) {
            setMessage("Failed to delete product");
        }

        setDeleteModal({ show: false, product: null });
        setTimeout(() => setMessage(""), 3000);
    };

    useEffect(() => {
        if (categoryId) {
            const timer = setTimeout(() => {
                fetchProducts(categoryId);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [search, categoryId]);

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">Ghee & Oil Products</h3>
                <Link 
                    href="/admin/product" 
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm flex items-center gap-2"
                >
                    <FiPlus className="w-4 h-4" /> Add New
                </Link>
            </div>

            {message && (
                <div className={`p-4 mb-4 rounded-lg text-sm ${
                    message.includes("success") 
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                        : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                    {message}
                </div>
            )}

            <div className="mb-6">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                    <FiImage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p>No products found in Ghee & Oil category</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Image</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Price Range</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Stock</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {products.map((product) => {
                                const minPrice = product.weights?.length > 0 ? Math.min(...product.weights.map(w => w.price)) : 0;
                                const maxPrice = product.weights?.length > 0 ? Math.max(...product.weights.map(w => w.price)) : 0;
                                const totalStock = product.weights?.reduce((sum, w) => sum + (w.stock || 0), 0) || 0;

                                return (
                                    <tr key={product._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            {product.cover_image ? (
                                                <img src={product.cover_image} alt={product.firstName} className="w-12 h-12 object-cover rounded-lg" />
                                            ) : (
                                                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                                    <FiImage className="w-5 h-5 text-gray-400" />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-800">{product.firstName}</p>
                                            {product.lastName && <p className="text-sm text-gray-500">{product.lastName}</p>}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            ৳{minPrice} - ৳{maxPrice}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                totalStock > 10 ? 'bg-green-100 text-green-700' : 
                                                totalStock > 0 ? 'bg-yellow-100 text-yellow-700' : 
                                                'bg-red-100 text-red-700'
                                            }`}>
                                                {totalStock} items
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Link
                                                    href={`/admin/product/all-products/${product._id}`}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <FiEdit className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => setDeleteModal({ show: true, product })}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {deleteModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Delete Product</h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete <strong>{deleteModal.product.firstName}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setDeleteModal({ show: false, product: null })} 
                                className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleDelete} 
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
