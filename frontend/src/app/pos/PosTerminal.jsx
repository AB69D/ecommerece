"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
    FiShoppingBag, FiLogOut, FiShoppingCart, FiTag, FiRotateCcw, FiBarChart2,
    FiCheckCircle, FiAlertCircle, FiX, FiExternalLink, FiClock, FiTruck,
} from "react-icons/fi";
import SellView from "./SellView";
import ReturnsView from "./ReturnsView";
import ReportsView from "./ReportsView";
import ShiftView from "./ShiftView";
import OrdersView from "./OrdersView";
import { canSell, canRead, canManage, canReadOrders, canChangeOrderStatus } from "./posPerms";
import { getPosSettings } from "@/services/pos";

export default function PosTerminal({ me, onLogout }) {
    const perms = me?.effectivePermissions || [];
    const sell = canSell(perms);
    const read = canRead(perms);
    const manage = canManage(perms);
    const readOrders = canReadOrders(perms);
    const changeOrders = canChangeOrderStatus(perms);

    // Shift tab visibility tracks the admin-toggleable posShift feature flag.
    const [shiftEnabled, setShiftEnabled] = useState(false);
    useEffect(() => {
        getPosSettings()
            .then((res) => { if (res?.success) setShiftEnabled(res.data?.features?.posShift !== false); })
            .catch(() => {});
    }, []);

    const tabs = useMemo(() => {
        const list = [];
        if (sell) {
            list.push({ key: "sell", label: "Sell", icon: FiShoppingCart });
            list.push({ key: "wholesale", label: "Wholesale", icon: FiTag });
            list.push({ key: "returns", label: "Returns", icon: FiRotateCcw });
        }
        if (readOrders) list.push({ key: "orders", label: "Orders", icon: FiTruck });
        if (shiftEnabled && (sell || read)) list.push({ key: "shift", label: "Shift", icon: FiClock });
        if (read) list.push({ key: "reports", label: "Reports", icon: FiBarChart2 });
        return list;
    }, [sell, read, readOrders, shiftEnabled]);

    const [tab, setTab] = useState(tabs[0]?.key || "reports");
    const [toasts, setToasts] = useState([]);

    const notify = useCallback((type, message) => {
        const id = Date.now() + Math.random();
        setToasts((t) => [...t, { id, type, message }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
    }, []);

    useEffect(() => {
        if (!tabs.find((t) => t.key === tab) && tabs[0]) setTab(tabs[0].key);
    }, [tabs, tab]);

    return (
        <div className="fixed inset-0 z-[60] bg-slate-100 flex flex-col">
            {/* Top bar */}
            <header className="bg-slate-900 text-white shrink-0">
                <div className="flex items-center justify-between px-3 sm:px-5 h-14">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shrink-0">
                            <FiShoppingBag className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <p className="font-bold leading-tight text-sm sm:text-base">POS Terminal</p>
                            <p className="text-[11px] text-slate-400 truncate">
                                {me?.fullName || me?.username} · {me?.role}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <a
                            href="/"
                            target="_blank"
                            rel="noreferrer"
                            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
                        >
                            <FiExternalLink className="w-4 h-4" /> Store
                        </a>
                        <button
                            onClick={onLogout}
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-red-500/20 hover:text-red-300 transition-colors"
                        >
                            <FiLogOut className="w-4 h-4" /> <span className="hidden xs:inline">Logout</span>
                        </button>
                    </div>
                </div>

                {/* Tabs (desktop) */}
                <nav className="hidden sm:flex items-center gap-1 px-5 -mb-px">
                    {tabs.map((t) => {
                        const Icon = t.icon;
                        const active = tab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                                    active
                                        ? "border-teal-400 text-white"
                                        : "border-transparent text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                <Icon className="w-4 h-4" />
                                {t.label}
                            </button>
                        );
                    })}
                </nav>
            </header>

            {/* Active view */}
            <main className="flex-1 min-h-0 overflow-hidden">
                {tab === "sell" && <SellView mode="retail" notify={notify} />}
                {tab === "wholesale" && <SellView mode="wholesale" notify={notify} />}
                {tab === "returns" && <ReturnsView notify={notify} />}
                {tab === "orders" && <OrdersView canChange={changeOrders} />}
                {tab === "shift" && <ShiftView notify={notify} canManage={manage} />}
                {tab === "reports" && <ReportsView />}
            </main>

            {/* Tabs (mobile bottom nav) */}
            <nav className="sm:hidden shrink-0 bg-slate-900 border-t border-slate-800 grid" style={{ gridTemplateColumns: `repeat(${tabs.length || 1}, minmax(0, 1fr))` }}>
                {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                                active ? "text-teal-400" : "text-slate-400"
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            {t.label}
                        </button>
                    );
                })}
            </nav>

            {/* Toasts */}
            <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] space-y-2 w-[92%] max-w-sm">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm border ${
                            t.type === "error"
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                    >
                        {t.type === "error" ? <FiAlertCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <FiCheckCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                        <span className="flex-1">{t.message}</span>
                        <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="opacity-60 hover:opacity-100">
                            <FiX className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
