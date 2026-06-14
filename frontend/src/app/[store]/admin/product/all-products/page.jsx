"use client";
import { authFetch } from "@/services/api";
import React, { useState, useEffect, useRef } from "react";
import Link from "@/components/StoreLink";
import { FiEdit, FiTrash2, FiSearch, FiX, FiImage } from "react-icons/fi";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useCurrency } from "@/context/CurrencyContext.jsx";

// Mirror of the backend GS1 (prefix 2) barcode generator for in-form previews.
const genBarcodePreview = (index = 0) => {
    const ts = String(Date.now()).slice(-8);
    const rand = String(Math.floor(Math.random() * 90) + 10);
    const idx = String(index % 100).padStart(2, "0");
    return `2${ts}${rand}${idx}`;
};

export default function AllProductsPage() {
    const { can } = useAdminAuth();
    const canWrite = can("product:write");
    const canDelete = can("product:delete");
    const { symbol } = useCurrency();

    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [deleteModal, setDeleteModal] = useState({ show: false, product: null });
    const [editModal, setEditModal] = useState({ show: false, product: null });
    const [editShowEcom, setEditShowEcom] = useState(true);
    const [editWeights, setEditWeights] = useState([]);
    const [editQa, setEditQa] = useState([]);
    const [editError, setEditError] = useState("");
    const [editCoverImage, setEditCoverImage] = useState(null);
    const [categories, setCategories] = useState([]);
    const [message, setMessage] = useState("");
    const msgTimer = useRef(null);

    const openEdit = (product) => {
        setEditShowEcom(product.showInEcommerce !== false);
        setEditWeights(
            (product.weights || []).map((w) => ({
                weight: w.weight ?? "",
                stock: w.stock ?? "",
                price: w.price ?? "",
                costPrice: w.costPrice ?? "",
                discountPercent: w.discountPercent ?? 0,
                sku: w.sku ?? "",
                barcode: w.barcode ?? "",
                images: w.images || [],
            })),
        );
        setEditQa((product.qa || []).map((q) => ({ ...q })));
        setEditError("");
        setEditCoverImage(null);
        setEditModal({ show: true, product });
    };

    const updateEditWeight = (index, field, value) => {
        setEditWeights((prev) => prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
    };

    const showMessage = (msg) => {
        if (msgTimer.current) clearTimeout(msgTimer.current);
        setMessage(msg);
        msgTimer.current = setTimeout(() => setMessage(''), 3000);
    };

    const limit = 10;

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await authFetch(`/api/admin/category/get-all-category`);
                const data = await res.json();
                if (data.success) {
                    setCategories(data.data);
                }
            } catch (error) {
                console.error("Failed to fetch categories:", error);
            }
        };
        fetchCategories();
    }, []);

    useEffect(() => {
        const fetchProducts = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/api/admin/product/get-all-product`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ page, limit, search })
                });
                const data = await res.json();
                if (data.success) {
                    setProducts(data.data);
                    setTotalPages(data.totalNoPage || 1);
                }
            } catch (error) {
                console.error("Failed to fetch products:", error);
            } finally {
                setLoading(false);
            }
        };

        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);

        return () => clearTimeout(timer);
    }, [page, search]);

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
                showMessage("Product deleted successfully");
                setProducts(products.filter(p => p._id !== deleteModal.product._id));
            } else {
                showMessage("Failed to delete product");
            }
        } catch (error) {
            showMessage("Failed to delete product");
        }

        setDeleteModal({ show: false, product: null });
    };

    const handleEdit = async (e) => {
        e.preventDefault();
        setEditError("");
        const formEl = e.target;
        const formFields = new FormData(formEl);

        const fd = new FormData();
        fd.append("_id", editModal.product._id);
        fd.append("firstName", formFields.get("firstName") || "");
        fd.append("lastName", formFields.get("lastName") || "");
        fd.append("category", formFields.get("category") || "");
        fd.append("description", formFields.get("description") || "");
        fd.append("qa", JSON.stringify(editQa));
        fd.append("showInEcommerce", String(editShowEcom));
        fd.append("weights", JSON.stringify(editWeights.map((w) => ({
            weight: w.weight,
            stock: parseInt(w.stock) || 0,
            price: parseFloat(w.price) || 0,
            costPrice: parseFloat(w.costPrice) || 0,
            discountPercent: parseFloat(w.discountPercent) || 0,
            sku: (w.sku || "").trim(),
            barcode: (w.barcode || "").trim(),
            images: w.images || [],
        }))));
        if (editCoverImage) {
            fd.append("cover_image", editCoverImage);
        }

        try {
            const res = await authFetch(`/api/admin/product/update-product-details`, {
                method: "PUT",
                body: fd,
            });
            const data = await res.json();

            if (data.success) {
                const categoryId = formFields.get("category");
                const cat = categories.find(c => c._id === categoryId);
                const updatedProducts = products.map(p =>
                    p._id === editModal.product._id
                        ? {
                            ...p,
                            firstName: formFields.get("firstName") || p.firstName,
                            lastName: formFields.get("lastName") || p.lastName,
                            description: formFields.get("description") || p.description,
                            showInEcommerce: editShowEcom,
                            qa: editQa,
                            weights: editWeights.map((w) => ({
                                ...w,
                                stock: parseInt(w.stock) || 0,
                                price: parseFloat(w.price) || 0,
                                costPrice: parseFloat(w.costPrice) || 0,
                                discountPercent: parseFloat(w.discountPercent) || 0,
                            })),
                            category: cat ? { _id: cat._id, category_name: cat.category_name } : p.category,
                          }
                        : p
                );
                setProducts(updatedProducts);
                showMessage("Product updated successfully");
                setEditModal({ show: false, product: null });
            } else {
                setEditError(data.message || "Failed to update product");
            }
        } catch (error) {
            setEditError("Failed to update product");
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-800">All Products</h3>
                {canWrite && (
                    <Link href="/admin/product" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                        + Add New
                    </Link>
                )}
            </div>

            {message && (
                <div className={`p-4 mb-4 rounded-lg text-sm ${message.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
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
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : products.length === 0 ? (
                <div className="text-center py-20 text-gray-500">No products found</div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Image</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Product</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Category</th>
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
                                                {product.showInEcommerce === false && (
                                                    <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                                        POS only
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {product.category?.category_name || 'N/A'}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-gray-600">
                                                {symbol}{minPrice} - {symbol}{maxPrice}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${totalStock > 10 ? 'bg-green-100 text-green-700' : totalStock > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                                    {totalStock} items
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {canWrite && (
                                                        <button
                                                            onClick={() => openEdit(product)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                        >
                                                            <FiEdit className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => setDeleteModal({ show: true, product })}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!canWrite && !canDelete && (
                                                        <span className="text-xs text-gray-400">View only</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-600">Page {page} of {totalPages}</span>
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1 border rounded-lg disabled:opacity-50 hover:bg-gray-100"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {deleteModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Delete Product</h3>
                        <p className="text-gray-600 mb-6">Are you sure you want to delete <strong>{deleteModal.product.firstName}</strong>? This action cannot be undone.</p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setDeleteModal({ show: false, product: null })} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {editModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
                    <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 my-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-gray-800">Edit Product</h3>
                            <button onClick={() => setEditModal({ show: false, product: null })} className="p-2 hover:bg-gray-100 rounded-lg">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEdit}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                                    <input type="text" name="firstName" defaultValue={editModal.product.firstName} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                                    <input type="text" name="lastName" defaultValue={editModal.product.lastName} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select name="category" defaultValue={editModal.product.category?._id} required className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                                    <option value="">Select Category</option>
                                    {categories.map((cat) => (
                                        <option key={cat._id} value={cat._id}>{cat.category_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <textarea name="description" defaultValue={editModal.product.description} rows={4} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                                <label className="flex items-start gap-3 p-3 border border-gray-300 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
                                    <input
                                        type="checkbox"
                                        checked={editShowEcom}
                                        onChange={(e) => setEditShowEcom(e.target.checked)}
                                        className="mt-0.5 w-5 h-5 accent-emerald-600 shrink-0"
                                    />
                                    <span className="text-sm">
                                        <span className="font-medium text-gray-800 block">Show on e-commerce storefront</span>
                                        <span className="text-gray-500">
                                            {editShowEcom
                                                ? "Visible to online shoppers and sellable at the POS."
                                                : "Hidden from the website — available at the POS terminal only."}
                                        </span>
                                    </span>
                                </label>
                            </div>
                            {editWeights.length > 0 && (
                                <div className="mb-4 border-t pt-4">
                                    <h4 className="text-sm font-semibold text-gray-800 mb-3">Variants · Stock, SKU &amp; Barcode</h4>
                                    <div className="space-y-3">
                                        {editWeights.map((w, index) => (
                                            <div key={index} className="bg-gray-50 border rounded-lg p-3">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 mb-1">Weight</label>
                                                        <input type="text" value={w.weight} onChange={(e) => updateEditWeight(index, "weight", e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 mb-1">Stock</label>
                                                        <input type="number" value={w.stock} onChange={(e) => updateEditWeight(index, "stock", e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 mb-1">Price ($)</label>
                                                        <input type="number" value={w.price} onChange={(e) => updateEditWeight(index, "price", e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 mb-1">Cost ($)</label>
                                                        <input type="number" value={w.costPrice} onChange={(e) => updateEditWeight(index, "costPrice", e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="for profit" />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 mb-1">SKU</label>
                                                        <input type="text" value={w.sku} onChange={(e) => updateEditWeight(index, "sku", e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="auto if blank" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[10px] text-gray-500 mb-1">Barcode</label>
                                                        <div className="flex gap-1.5">
                                                            <input type="text" value={w.barcode} onChange={(e) => updateEditWeight(index, "barcode", e.target.value)} className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="auto if blank" />
                                                            <button type="button" onClick={() => updateEditWeight(index, "barcode", genBarcodePreview(index))} title="Generate a barcode" className="shrink-0 px-2.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold hover:bg-emerald-100">Gen</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-2">Leave SKU / barcode blank to auto-generate a scannable code on save.</p>
                                </div>
                            )}

                            {/* Cover image upload */}
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                                {editModal.product.cover_image && !editCoverImage && (
                                    <img src={editModal.product.cover_image} alt="Current cover" className="w-16 h-16 object-cover rounded-lg mb-2 border" />
                                )}
                                {editCoverImage && (
                                    <img src={URL.createObjectURL(editCoverImage)} alt="New cover" className="w-16 h-16 object-cover rounded-lg mb-2 border" />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setEditCoverImage(e.target.files?.[0] || null)}
                                    className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:border-0 file:rounded-lg file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                                />
                            </div>

                            {/* Q&A editor */}
                            <div className="mb-4 border-t pt-4">
                                <h4 className="text-sm font-semibold text-gray-800 mb-3">Q&amp;A</h4>
                                <div className="space-y-2">
                                    {editQa.map((item, idx) => (
                                        <div key={idx} className="bg-gray-50 border rounded-lg p-3 flex gap-2">
                                            <div className="flex-1 space-y-1.5">
                                                <input
                                                    type="text"
                                                    value={item.question}
                                                    onChange={(e) => setEditQa(prev => prev.map((q, i) => i === idx ? { ...q, question: e.target.value } : q))}
                                                    placeholder="Question"
                                                    className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={item.answer}
                                                    onChange={(e) => setEditQa(prev => prev.map((q, i) => i === idx ? { ...q, answer: e.target.value } : q))}
                                                    placeholder="Answer"
                                                    className="w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                />
                                            </div>
                                            <button type="button" onClick={() => setEditQa(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                                                <FiX className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button type="button" onClick={() => setEditQa(prev => [...prev, { question: "", answer: "" }])} className="mt-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                                    + Add Q&amp;A
                                </button>
                            </div>

                            {editError && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                                    {editError}
                                </div>
                            )}
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => setEditModal({ show: false, product: null })} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Save Changes</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}