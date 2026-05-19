"use client";
import { authFetch } from "@/services/api";
import { useState, useEffect } from "react";
import { FiPercent, FiEdit2, FiX, FiCheck } from "react-icons/fi";

export default function DiscountPage() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);
    const [editingWeightIndex, setEditingWeightIndex] = useState(null);
    const [discountPercent, setDiscountPercent] = useState(0);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/api/admin/product/get-all-product`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: 1, limit: 100 })
            });
            const data = await res.json();
            if (data.success) {
                setProducts(data.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch products:", error);
        } finally {
            setLoading(false);
        }
    };

    const openDiscountModal = (product, weightIndex) => {
        setEditingProduct(product);
        setEditingWeightIndex(weightIndex);
        setDiscountPercent(product.weights[weightIndex]?.discountPercent || 0);
        setMessage("");
    };

    const closeModal = () => {
        setEditingProduct(null);
        setEditingWeightIndex(null);
        setDiscountPercent(0);
        setMessage("");
    };

    const saveDiscount = async () => {
        if (!editingProduct || editingWeightIndex === null) return;

        setSaving(true);
        setMessage("");

        try {
            const res = await authFetch(`/api/admin/product/update-discount`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    productId: editingProduct._id,
                    weightIndex: editingWeightIndex,
                    discountPercent: parseFloat(discountPercent) || 0
                })
            });
            const data = await res.json();

            if (data.success) {
                setMessage("Discount updated successfully!");
                fetchProducts();
                setTimeout(() => closeModal(), 1000);
            } else {
                setMessage(`Error: ${data.message}`);
            }
        } catch (error) {
            setMessage("Failed to update discount.");
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const getDiscountedPrice = (price, discountPercent) => {
        return price - (price * discountPercent / 100);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Manage Discounts</h3>

            {message && (
                <div className={`p-4 mb-6 rounded-lg font-medium text-sm border ${
                    message.includes("successfully") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                }`}>
                    {message}
                </div>
            )}

            <div className="space-y-4">
                {products.map((product) => (
                    <div key={product._id} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                <img 
                                    src={product.cover_image || '/logo.png'} 
                                    alt={product.firstName}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-semibold text-gray-800">{product.firstName} {product.lastName}</h4>
                                <p className="text-sm text-gray-500">{product.category?.category_name}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {product.weights?.map((weight, index) => (
                                <div 
                                    key={index} 
                                    className={`border rounded-lg p-3 flex items-center justify-between ${
                                        weight.discountPercent > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                                    }`}
                                >
                                    <div>
                                        <p className="font-medium text-gray-800">{weight.weight}</p>
                                        <div className="flex items-center gap-2">
                                            {weight.discountPercent > 0 ? (
                                                <>
                                                    <p className="text-sm text-gray-400 line-through">৳{weight.price}</p>
                                                    <p className="text-sm font-bold text-emerald-600">
                                                        ৳{getDiscountedPrice(weight.price, weight.discountPercent).toFixed(0)}
                                                    </p>
                                                    <span className="text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded">
                                                        -{weight.discountPercent}%
                                                    </span>
                                                </>
                                            ) : (
                                                <p className="text-sm font-bold text-gray-800">৳{weight.price}</p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => openDiscountModal(product, index)}
                                        className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                        title="Edit discount"
                                    >
                                        <FiEdit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {products.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                    <p>No products found.</p>
                </div>
            )}

            {editingProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
                    <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-xl font-bold text-gray-800">Edit Discount</h4>
                            <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <FiX className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-1">
                                Product: <span className="font-medium">{editingProduct.firstName}</span>
                            </p>
                            <p className="text-sm text-gray-600">
                                Weight: <span className="font-medium">
                                    {editingProduct.weights[editingWeightIndex]?.weight}
                                </span>
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Discount Percentage
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={discountPercent}
                                    onChange={(e) => setDiscountPercent(e.target.value)}
                                    min="0"
                                    max="100"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none pr-12"
                                    placeholder="Enter discount %"
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                    <FiPercent className="w-5 h-5" />
                                </div>
                            </div>
                            {discountPercent > 0 && (
                                <p className="mt-2 text-sm text-emerald-600">
                                    Discounted price: ৳{getDiscountedPrice(
                                        editingProduct.weights[editingWeightIndex]?.price,
                                        discountPercent
                                    ).toFixed(0)}
                                    {" "}(was ৳{editingProduct.weights[editingWeightIndex]?.price})
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveDiscount}
                                disabled={saving}
                                className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <FiCheck className="w-4 h-4" />
                                        Save
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
