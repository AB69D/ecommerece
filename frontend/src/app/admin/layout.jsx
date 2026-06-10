"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    FiGrid, FiPackage, FiLayout, FiList, FiTruck, FiMenu, FiX, FiSettings,
    FiHome, FiPercent, FiStar, FiLogOut, FiUsers, FiShield, FiFileText, FiUser,
    FiShoppingBag, FiTag,
} from "react-icons/fi";
import { isAuthenticated, logout, fetchMe } from "@/services/adminAuth";
import { AdminAuthContext, buildCan } from "@/context/AdminAuthContext";
import { hasAnyPermission } from "@/lib/permissions";

export default function AdminLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [checkedAuth, setCheckedAuth] = useState(false);
    const [me, setMe] = useState(null);

    const isLoginPage = pathname === '/admin/login';

    const loadMe = useCallback(async () => {
        const result = await fetchMe();
        if (result?.success && result.data) {
            setMe(result.data);
            return true;
        }
        return false;
    }, []);

    useEffect(() => {
        // The login page renders below without gating, so skip auth work there.
        if (isLoginPage) return;
        if (!isAuthenticated()) {
            router.replace('/admin/login');
            return;
        }
        (async () => {
            const okMe = await loadMe();
            if (!okMe) {
                logout();
                router.replace('/admin/login');
            } else {
                setCheckedAuth(true);
            }
        })();
    }, [isLoginPage, router, loadMe]);

    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (!mobile) setSidebarOpen(false);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        document.body.style.overflow = sidebarOpen ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [sidebarOpen]);

    if (isLoginPage) {
        return <>{children}</>;
    }

    if (!checkedAuth) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-emerald-600 rounded-full animate-spin" />
            </div>
        );
    }

    // perms: list of permissions; the item shows if the user has ANY of them.
    // An empty perms list means "always visible".
    const menuGroups = [
        {
            title: 'Overview',
            items: [
                { name: 'Dashboard', path: '/admin', icon: <FiGrid className="w-5 h-5" />, perms: [] },
            ],
        },
        {
            title: 'Commerce',
            items: [
                { name: 'Orders', path: '/admin/orders', icon: <FiTruck className="w-5 h-5" />, perms: ['order:read'] },
                { name: 'Customers', path: '/admin/customers', icon: <FiUser className="w-5 h-5" />, perms: ['customer:read'] },
                { name: 'Add Category', path: '/admin/category', icon: <FiGrid className="w-5 h-5" />, perms: ['category:write'] },
                { name: 'All Categories', path: '/admin/category/all-categories', icon: <FiList className="w-5 h-5" />, perms: ['category:read'] },
                { name: 'Upload Product', path: '/admin/product', icon: <FiPackage className="w-5 h-5" />, perms: ['product:write'] },
                { name: 'All Products', path: '/admin/product/all-products', icon: <FiPackage className="w-5 h-5" />, perms: ['product:read'] },
                { name: 'Barcode Labels', path: '/admin/labels', icon: <FiTag className="w-5 h-5" />, perms: ['product:read'] },
                { name: 'Ghee & Oil', path: '/admin/ghee-oil', icon: <FiPackage className="w-5 h-5" />, perms: ['product:read'] },
                { name: 'Honey & Sweets', path: '/admin/honey-sweets', icon: <FiPackage className="w-5 h-5" />, perms: ['product:read'] },
                { name: 'Stock Management', path: '/admin/stock', icon: <FiTruck className="w-5 h-5" />, perms: ['inventory:read'] },
                { name: 'Discounts', path: '/admin/discount', icon: <FiPercent className="w-5 h-5" />, perms: ['discount:read'] },
            ],
        },
        {
            title: 'Storefront',
            items: [
                { name: 'Headers', path: '/admin/header', icon: <FiLayout className="w-5 h-5" />, perms: ['header:read'] },
                { name: 'Reviews', path: '/admin/reviews', icon: <FiStar className="w-5 h-5" />, perms: ['review:read'] },
                { name: 'Site Settings', path: '/admin/settings', icon: <FiSettings className="w-5 h-5" />, perms: ['content:read'] },
            ],
        },
        {
            title: 'Administration',
            items: [
                { name: 'Users & Roles', path: '/admin/admins', icon: <FiUsers className="w-5 h-5" />, perms: ['user:read'] },
                { name: 'POS Sellers', path: '/admin/pos-sellers', icon: <FiShoppingBag className="w-5 h-5" />, perms: ['user:read'] },
                { name: 'Audit Logs', path: '/admin/audit-logs', icon: <FiFileText className="w-5 h-5" />, perms: ['audit:read'] },
                { name: 'My Account', path: '/admin/account', icon: <FiUser className="w-5 h-5" />, perms: [] },
            ],
        },
    ];

    const ctxValue = { me, loading: false, can: buildCan(me), refresh: loadMe };

    return (
        <AdminAuthContext.Provider value={ctxValue}>
            <div className="min-h-screen bg-gray-100 flex">
                <button
                    onClick={() => setSidebarOpen(true)}
                    className={`fixed top-4 left-4 z-50 p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg transition-all lg:hidden ${sidebarOpen ? 'hidden' : ''}`}
                    aria-label="Open menu"
                >
                    <FiMenu className="w-5 h-5" />
                </button>

                {sidebarOpen && isMobile && (
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                <div className={`
                    fixed top-0 left-0 h-full z-50 transition-all duration-300 ease-out
                    lg:relative lg:translate-x-0
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    <div className="h-full w-64 bg-white border-r border-gray-200 flex flex-col shadow-xl lg:shadow-none">
                        <div className="p-5 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                <Link href="/admin" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                                        <FiSettings className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <span className="text-base font-bold text-gray-800 block">Admin</span>
                                        <span className="text-xs text-gray-400">
                                            {me?.username ? `@${me.username}` : 'Panel'}
                                        </span>
                                    </div>
                                </Link>
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors lg:hidden"
                                    aria-label="Close menu"
                                >
                                    <FiX className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {menuGroups.map((group) => {
                                const visible = group.items.filter((it) => hasAnyPermission(me, it.perms));
                                if (visible.length === 0) return null;
                                return (
                                    <div key={group.title}>
                                        <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                            {group.title}
                                        </p>
                                        <div className="space-y-1">
                                            {visible.map((item) => {
                                                const isActive = pathname === item.path;
                                                return (
                                                    <Link
                                                        key={item.path}
                                                        href={item.path}
                                                        onClick={() => setSidebarOpen(false)}
                                                        className={`
                                                            flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium text-sm transition-all
                                                            ${isActive
                                                                ? "bg-indigo-600 text-white shadow-md"
                                                                : "text-gray-600 hover:bg-gray-50 hover:text-indigo-600"
                                                            }
                                                        `}
                                                    >
                                                        {item.icon}
                                                        <span>{item.name}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="p-4 border-t border-gray-100 space-y-1">
                            <Link
                                href="/"
                                target="_blank"
                                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:text-indigo-600 hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                <FiHome className="w-5 h-5" />
                                View Website
                            </Link>
                            <button
                                onClick={() => { logout(); router.replace('/admin/login'); }}
                                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors w-full"
                            >
                                <FiLogOut className="w-5 h-5" />
                                Logout
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-screen p-4 lg:p-6 overflow-y-auto lg:ml-0">
                    <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
                        {children}
                    </div>
                </div>
            </div>
        </AdminAuthContext.Provider>
    );
}
