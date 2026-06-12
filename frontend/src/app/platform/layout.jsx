"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FiGrid, FiGlobe, FiShield, FiLogOut, FiSlash, FiTag, FiBell } from "react-icons/fi";
import { isAuthenticated, logout, fetchMe } from "@/services/adminAuth";
import { AdminAuthContext, buildCan } from "@/context/AdminAuthContext";

const NAV = [
    { name: "Overview", path: "/platform", icon: FiGrid },
    { name: "Stores", path: "/platform/stores", icon: FiGlobe },
    { name: "Plans", path: "/platform/plans", icon: FiTag },
    { name: "Announcements", path: "/platform/announcements", icon: FiBell },
    { name: "Owners", path: "/platform/owners", icon: FiShield },
];

export default function PlatformLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();
    const [me, setMe] = useState(null);
    const [checked, setChecked] = useState(false);

    const loadMe = useCallback(async () => {
        const res = await fetchMe();
        if (res?.success && res.data) { setMe(res.data); return res.data; }
        return null;
    }, []);

    useEffect(() => {
        if (!isAuthenticated()) { router.replace("/"); return; }
        (async () => {
            const m = await loadMe();
            if (!m) { logout(); router.replace("/"); }
            else setChecked(true);
        })();
    }, [router, loadMe]);

    if (!checked) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="w-10 h-10 border-4 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (!me?.isPlatformOwner) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                    <FiSlash className="w-7 h-7 text-red-500" />
                </div>
                <h1 className="text-xl font-bold text-gray-800">Platform owners only</h1>
                <p className="text-sm text-gray-500 mt-2 max-w-sm">
                    This console controls every store on the platform and is restricted to platform owners.
                </p>
                <button
                    onClick={() => { logout(); router.replace("/login"); }}
                    className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl"
                >
                    <FiLogOut className="w-4 h-4" /> Sign in to a store instead
                </button>
            </div>
        );
    }

    const ctx = { me, loading: false, can: buildCan(me), refresh: loadMe };

    return (
        <AdminAuthContext.Provider value={ctx}>
            <div className="min-h-screen bg-gray-100 flex flex-col">
                <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
                    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16 gap-4">
                            <Link href="/platform" className="flex items-center gap-2.5 shrink-0">
                                <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow">
                                    <FiShield className="w-5 h-5 text-white" />
                                </div>
                                <div className="leading-tight">
                                    <span className="block text-sm font-bold text-gray-800">Platform</span>
                                    <span className="block text-[11px] text-gray-400">{me?.username ? `@${me.username}` : "owner"}</span>
                                </div>
                            </Link>

                            <nav className="flex items-center gap-1 overflow-x-auto">
                                {NAV.map((item) => {
                                    const active = item.path === "/platform" ? pathname === "/platform" : pathname.startsWith(item.path);
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.path}
                                            href={item.path}
                                            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                                                active ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                                            }`}
                                        >
                                            <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </nav>

                            <button
                                onClick={() => { logout(); router.replace("/"); }}
                                className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg shrink-0"
                            >
                                <FiLogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign out</span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </AdminAuthContext.Provider>
    );
}
