"use client";
import { authFetch } from "@/services/api";
import React, { useState, useEffect } from "react";
import { FiSearch, FiPlus, FiMinus, FiAlertCircle, FiTrendingUp, FiPackage, FiAlertTriangle, FiMapPin } from "react-icons/fi";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { useCurrency } from "@/context/CurrencyContext.jsx";

export default function StockManagementPage() {
    const { can } = useAdminAuth();
    const canWrite = can("inventory:write");
    const { symbol } = useCurrency();

    const [stockData, setStockData] = useState([]);
    const [summary, setSummary] = useState({ totalProducts: 0, totalItemsInStock: 0, totalInventoryValue: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [message, setMessage] = useState("");
    const [adjustModal, setAdjustModal] = useState({ show: false, product: null, weightIndex: null });
    const [adjustForm, setAdjustForm] = useState({ quantity: "", action: "add", reason: "" });

    // Multi-warehouse: location filter
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState("");
    const [locationStockData, setLocationStockData] = useState([]);
    const [locationLoading, setLocationLoading] = useState(false);
    const multiWarehouse = locations.length > 0;

    useEffect(() => {
        // Try to load locations — if multi-warehouse is enabled the API returns them
        (async () => {
            try {
                const res = await authFetch("/api/v1/admin/location");
                const d = await res.json();
                if (d?.success && (d.data || []).length > 0) {
                    setLocations(d.data.filter((l) => l.active !== false));
                }
            } catch {
                /* multi-warehouse not enabled — ignore */
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedLocation) return;
        setLocationLoading(true);
        (async () => {
            try {
                const res = await authFetch(`/api/v1/admin/location/${selectedLocation}/stock?limit=200`);
                const d = await res.json();
                if (d?.success) setLocationStockData(d.data?.items || []);
            } catch {
                setLocationStockData([]);
            } finally {
                setLocationLoading(false);
            }
        })();
    }, [selectedLocation]);

    useEffect(() => {
        const fetchStockData = async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/api/admin/order/stock-report`, {
                    method: "POST"
                });
                const data = await res.json();
                if (data.success) {
                    setStockData(data.data);
                    setSummary(data.summary);
                }
            } catch (error) {
                console.error("Failed to fetch stock data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStockData();
    }, []);

    const filteredData = stockData.filter(item => 
        item.productName.toLowerCase().includes(search.toLowerCase()) ||
        item.category.toLowerCase().includes(search.toLowerCase())
    );

    const handleAdjustStock = async (e) => {
        e.preventDefault();
        if (!adjustModal.product || adjustModal.weightIndex === null) return;

        try {
            const res = await authFetch(`/api/admin/order/update-stock`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: adjustModal.product._id,
                    weightIndex: adjustModal.weightIndex,
                    quantity: parseInt(adjustForm.quantity),
                    action: adjustForm.action,
                    ...(adjustForm.reason ? { note: adjustForm.reason } : {})
                })
            });
            const data = await res.json();

            if (data.success) {
                setMessage("Stock updated successfully");
                const updatedData = stockData.map(item => {
                    if (item._id === adjustModal.product._id) {
                        const updatedWeights = item.weights.map((w, idx) => {
                            if (idx === adjustModal.weightIndex) {
                                return {
                                    ...w,
                                    stock: adjustForm.action === "add" 
                                        ? w.stock + parseInt(adjustForm.quantity) 
                                        : w.stock - parseInt(adjustForm.quantity)
                                };
                            }
                            return w;
                        });
                        const newTotalStock = updatedWeights.reduce((sum, w) => sum + w.stock, 0);
                        const newTotalValue = updatedWeights.reduce((sum, w) => sum + (w.stock * w.price), 0);
                        return { ...item, weights: updatedWeights, totalStock: newTotalStock, totalValue: newTotalValue };
                    }
                    return item;
                });
                setStockData(updatedData);
            } else {
                setMessage(data.message || "Failed to update stock");
            }
        } catch (error) {
            setMessage("Failed to update stock");
        }

        setAdjustModal({ show: false, product: null, weightIndex: null });
        setAdjustForm({ quantity: "", action: "add", reason: "" });
        setTimeout(() => setMessage(""), 3000);
    };

    return (
        <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6">Stock Management</h3>

            {message && (
                <div className={`p-4 mb-4 rounded-lg text-sm ${message.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                    {message}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm">Total Products</p>
                            <p className="text-3xl font-bold mt-1">{summary.totalProducts}</p>
                        </div>
                        <FiPackage className="w-10 h-10 text-emerald-200 opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Items in Stock</p>
                            <p className="text-3xl font-bold mt-1">{summary.totalItemsInStock.toLocaleString()}</p>
                        </div>
                        <FiTrendingUp className="w-10 h-10 text-blue-200 opacity-50" />
                    </div>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">Inventory Value</p>
                            <p className="text-3xl font-bold mt-1">{symbol}{summary.totalInventoryValue.toLocaleString()}</p>
                        </div>
                        <FiAlertCircle className="w-10 h-10 text-purple-200 opacity-50" />
                    </div>
                </div>
            </div>

            {/* Low stock alert banner */}
            {!loading && (() => {
                const lowStock = stockData.flatMap(p =>
                    p.weights
                        .filter(w => w.stock <= 5)
                        .map(w => ({ productName: p.productName, weight: w.weight, stock: w.stock, _id: p._id, weightIndex: w.weightIndex }))
                );
                if (lowStock.length === 0) return null;
                return (
                    <div className="mb-6 border border-amber-200 bg-amber-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <FiAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                            <h4 className="font-semibold text-amber-800 text-sm">{lowStock.length} variant{lowStock.length !== 1 ? "s" : ""} running low</h4>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {lowStock.map((item, i) => (
                                <span key={i} className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${item.stock === 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                                    {item.stock === 0 ? "OUT" : item.stock} · {item.productName}{item.weight ? ` (${item.weight})` : ""}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Location filter — only shown when multi-warehouse is enabled */}
            {multiWarehouse && (
                <div className="mb-4 flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FiMapPin className="w-4 h-4 text-indigo-500" />
                        <span className="font-medium">Location:</span>
                    </div>
                    <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="">All locations (aggregate)</option>
                        {locations.map((l) => (
                            <option key={l._id} value={l._id}>
                                {l.name} ({l.code})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Location-specific stock view */}
            {multiWarehouse && selectedLocation && (
                <div className="mb-6">
                    {locationLoading ? (
                        <div className="py-8 flex justify-center">
                            <div className="w-7 h-7 border-3 border-gray-200 border-t-indigo-600 rounded-full animate-spin" />
                        </div>
                    ) : locationStockData.length === 0 ? (
                        <div className="border-2 border-dashed border-gray-200 rounded-xl py-10 text-center">
                            <FiPackage className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No stock at this location.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100">
                                        <th className="pb-3 pr-4">Product</th>
                                        <th className="pb-3 pr-4">Variant</th>
                                        <th className="pb-3 pr-4 text-right">Stock</th>
                                        <th className="pb-3 pr-4 text-right">Reserved</th>
                                        <th className="pb-3 text-right">Available</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {locationStockData
                                        .filter((it) =>
                                            !search || (it.productName || "").toLowerCase().includes(search.toLowerCase())
                                        )
                                        .map((item, idx) => {
                                            const available = item.stock - (item.reservedQty || 0);
                                            return (
                                                <tr key={idx} className={`${available < 5 ? "bg-red-50" : "hover:bg-gray-50"}`}>
                                                    <td className="py-2.5 pr-4 font-medium text-gray-800">{item.productName}</td>
                                                    <td className="py-2.5 pr-4 text-gray-500">{item.weight || `Variant ${item.weightIndex}`}</td>
                                                    <td className="py-2.5 pr-4 text-right font-mono text-gray-800">{item.stock}</td>
                                                    <td className="py-2.5 pr-4 text-right font-mono text-gray-500">{item.reservedQty || 0}</td>
                                                    <td className={`py-2.5 text-right font-mono font-semibold ${available < 5 ? "text-red-600" : "text-gray-800"}`}>
                                                        {available}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            <div className="mb-6">
                <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by product name or category..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
            </div>

            {!selectedLocation && loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
                </div>
            ) : !selectedLocation && filteredData.length === 0 ? (
                <div className="text-center py-20 text-gray-500">No stock data found</div>
            ) : !selectedLocation ? (
                <div className="space-y-4">
                    {filteredData.map((product) => (
                        <div key={product._id} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="bg-gray-50 p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {product.coverImage ? (
                                        <img src={product.coverImage} alt={product.productName} className="w-12 h-12 object-cover rounded-lg" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                                            <FiPackage className="w-6 h-6 text-gray-400" />
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="font-semibold text-gray-800">{product.productName}</h4>
                                        <p className="text-sm text-gray-500">{product.category}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-gray-800">Total: {product.totalStock} items</p>
                                    <p className="text-sm text-emerald-600">Value: {symbol}{product.totalValue.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    {product.weights.map((weight, index) => (
                                        <div key={index} className="bg-white border border-gray-100 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="font-medium text-gray-700">{weight.weight}</span>
                                                <span className="text-emerald-600 font-semibold">{symbol}{weight.price}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    weight.stock > 10 ? 'bg-green-100 text-green-700' : 
                                                    weight.stock > 0 ? 'bg-yellow-100 text-yellow-700' : 
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    Stock: {weight.stock}
                                                </span>
                                                {canWrite && (
                                                    <button
                                                        onClick={() => setAdjustModal({ show: true, product, weightIndex: index })}
                                                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                                                    >
                                                        Adjust
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {adjustModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Adjust Stock</h3>
                        {adjustModal.product && (
                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                <p className="font-medium text-gray-800">{adjustModal.product.productName}</p>
                                <p className="text-sm text-gray-500">
                                    Current Weight: {adjustModal.product.weights[adjustModal.weightIndex]?.weight} | 
                                    Current Stock: {adjustModal.product.weights[adjustModal.weightIndex]?.stock}
                                </p>
                            </div>
                        )}
                        <form onSubmit={handleAdjustStock}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustForm({ ...adjustForm, action: "add" })}
                                        className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                                            adjustForm.action === "add" 
                                                ? "bg-emerald-50 border-emerald-500 text-emerald-700" 
                                                : "border-gray-300 hover:bg-gray-50"
                                        }`}
                                    >
                                        <FiPlus className="w-4 h-4" /> Add Stock
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustForm({ ...adjustForm, action: "subtract" })}
                                        className={`flex-1 py-2 px-4 rounded-lg border flex items-center justify-center gap-2 transition-colors ${
                                            adjustForm.action === "subtract" 
                                                ? "bg-red-50 border-red-500 text-red-700" 
                                                : "border-gray-300 hover:bg-gray-50"
                                        }`}
                                    >
                                        <FiMinus className="w-4 h-4" /> Remove Stock
                                    </button>
                                </div>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={adjustForm.quantity}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
                                    required
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-gray-400 font-normal">(optional)</span></label>
                                <input
                                    type="text"
                                    placeholder="e.g. New shipment, Damaged goods, Stocktake…"
                                    value={adjustForm.reason}
                                    onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                />
                            </div>
                            <div className="flex gap-3 justify-end">
                                <button type="button" onClick={() => { setAdjustModal({ show: false, product: null, weightIndex: null }); setAdjustForm({ quantity: "", action: "add", reason: "" }); }} className="px-4 py-2 border rounded-lg hover:bg-gray-100">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Confirm</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}