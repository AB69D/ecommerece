"use client";
import { authFetch } from "@/services/api";
import { useState, useEffect } from "react";
import { FiPackage, FiShoppingCart, FiDollarSign, FiTrendingUp, FiUsers, FiTruck, FiCheck, FiX, FiClock, FiActivity, FiGrid, FiArchive } from "react-icons/fi";
import Link from "next/link";

export default function DashboardPage() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [recentOrders, setRecentOrders] = useState([]);
    const [counts, setCounts] = useState({ products: 0, categories: 0 });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch order stats
            const statsRes = await authFetch(`/api/admin/order/stats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const statsData = await statsRes.json();

            if (statsData.success) {
                setStats(statsData.data);
            }

            // Fetch products count - use totalCount from response
            const productsRes = await authFetch(`/api/admin/product/get-all-product`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: 1, limit: 1 })
            });
            const productsData = await productsRes.json();
            if (productsData.success) {
                setCounts(prev => ({ ...prev, products: productsData.totalCount || 0 }));
            }

            // Fetch categories count  
            const categoriesRes = await authFetch(`/api/admin/category/get-all-category`);
            const categoriesData = await categoriesRes.json();
            if (categoriesData.success) {
                setCounts(prev => ({ ...prev, categories: categoriesData.data?.length || 0 }));
            }

            // Fetch recent orders - don't send status filter to get all
            const ordersRes = await authFetch(`/api/admin/order/get-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: 1, limit: 5 })
            });
            const ordersData = await ordersRes.json();

            if (ordersData.success) {
                setRecentOrders(ordersData.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        const colors = {
            pending: { bg: "bg-yellow-100 text-yellow-700", label: "Pending" },
            confirmed: { bg: "bg-blue-100 text-blue-700", label: "Confirmed" },
            processing: { bg: "bg-purple-100 text-purple-700", label: "Processing" },
            shipped: { bg: "bg-indigo-100 text-indigo-700", label: "Shipped" },
            delivered: { bg: "bg-green-100 text-green-700", label: "Delivered" },
            cancelled: { bg: "bg-red-100 text-red-700", label: "Cancelled" }
        };
        return colors[status] || colors.pending;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800">Dashboard</h3>
                <p className="text-gray-500 mt-1">Welcome to Gram2Ghor Admin Panel</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Products */}
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">Total Products</p>
                            <p className="text-3xl font-bold mt-1">{counts.products}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <FiPackage className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-blue-100 text-sm flex items-center gap-1">
                        <FiArchive className="w-4 h-4" />
                        All products
                    </div>
                </div>

                {/* Total Categories */}
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">Categories</p>
                            <p className="text-3xl font-bold mt-1">{counts.categories}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <FiGrid className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-purple-100 text-sm flex items-center gap-1">
                        <FiActivity className="w-4 h-4" />
                        All categories
                    </div>
                </div>

                {/* Total Orders */}
                <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-emerald-100 text-sm">Total Orders</p>
                            <p className="text-3xl font-bold mt-1">{stats?.totalOrders || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <FiShoppingCart className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-emerald-100 text-sm flex items-center gap-1">
                        <FiActivity className="w-4 h-4" />
                        All time orders
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-indigo-100 text-sm">Revenue</p>
                            <p className="text-3xl font-bold mt-1">৳{stats?.totalRevenue || 0}</p>
                        </div>
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                            <FiDollarSign className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4 text-indigo-100 text-sm flex items-center gap-1">
                        <FiTrendingUp className="w-4 h-4" />
                        Total earnings
                    </div>
                </div>
            </div>

            {/* Order Status Overview */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h4 className="font-semibold text-gray-800 mb-4">Order Status Overview</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <FiClock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-yellow-700">{stats?.pendingOrders || 0}</p>
                        <p className="text-xs text-yellow-600">Pending</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <FiCheck className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-700">{stats?.confirmedOrders || 0}</p>
                        <p className="text-xs text-blue-600">Confirmed</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <FiPackage className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-purple-700">{stats?.processingOrders || 0}</p>
                        <p className="text-xs text-purple-600">Processing</p>
                    </div>
                    <div className="text-center p-4 bg-indigo-50 rounded-lg">
                        <FiTruck className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-indigo-700">{stats?.shippedOrders || 0}</p>
                        <p className="text-xs text-indigo-600">Shipped</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                        <FiCheck className="w-6 h-6 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-700">{stats?.deliveredOrders || 0}</p>
                        <p className="text-xs text-green-600">Delivered</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                        <FiX className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-700">{stats?.cancelledOrders || 0}</p>
                        <p className="text-xs text-red-600">Cancelled</p>
                    </div>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-800">Recent Orders</h4>
                    <Link href="/admin/orders" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                        View All →
                    </Link>
                </div>
                {recentOrders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        <FiPackage className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p>No orders yet</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {recentOrders.map((order) => (
                                    <tr key={order._id} className="hover:bg-gray-50">
                                        <td className="px-5 py-4">
                                            <span className="font-mono text-sm font-medium text-emerald-700">{order.orderId}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="font-medium text-gray-800">{order.customerName}</p>
                                            <p className="text-sm text-gray-500">{order.customerPhone}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-gray-600">{order.items?.length || 0} items</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="font-bold text-gray-800">৳{order.totalAmount}</span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus).bg}`}>
                                                {getStatusColor(order.orderStatus).label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="text-sm text-gray-500">
                                                {new Date(order.createdAt).toLocaleDateString('en-GB')}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link href="/admin/orders" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-emerald-500 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <FiTruck className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">Orders</p>
                            <p className="text-sm text-gray-500">{stats?.totalOrders || 0} orders</p>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/product/all-products" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-emerald-500 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <FiPackage className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">Products</p>
                            <p className="text-sm text-gray-500">{counts.products} products</p>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/category/all-categories" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-emerald-500 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <FiGrid className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">Categories</p>
                            <p className="text-sm text-gray-500">{counts.categories} categories</p>
                        </div>
                    </div>
                </Link>
                <Link href="/admin/stock" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-emerald-500 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                            <FiTrendingUp className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-gray-800">Stock</p>
                            <p className="text-sm text-gray-500">Inventory</p>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    );
}