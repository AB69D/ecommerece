"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FiShoppingBag, FiX } from "react-icons/fi";

// Reads the non-httpOnly `store` cookie that middleware sets when a guest enters a
// store via /s/<sub>. Empty string = primary store (no banner).
const readStoreCookie = () => {
    if (typeof document === "undefined") return "";
    const m = document.cookie.match(/(?:^|;\s*)store=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : "";
};

// document.cookie isn't an event source, so there's nothing to subscribe to; the
// value is re-read whenever the component re-renders (e.g. on navigation).
const subscribe = () => () => {};

// A thin strip shown across the storefront while a guest is browsing a specific
// store on the SHARED domain (interim, before per-store subdomains exist). Tells
// them which store they're in and offers a one-click exit. Hidden in the admin
// panel and POS (separate apps, scoped by their own token) and on the primary
// store. useSyncExternalStore returns '' on the server so there's no hydration
// mismatch; the real cookie value fills in on the client.
export default function StoreBanner() {
    const pathname = usePathname();
    const store = useSyncExternalStore(subscribe, readStoreCookie, () => "");

    if (!store) return null;
    if (pathname?.startsWith("/admin") || pathname?.startsWith("/pos")) return null;

    const exitStore = () => {
        // The cookie is non-httpOnly: clear it here and hard-reload to the primary
        // store. (Middleware also exits on a direct visit to /s.)
        document.cookie = "store=; path=/; max-age=0";
        window.location.assign("/");
    };

    return (
        <div className="w-full bg-amber-500 text-amber-950">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-3 text-sm">
                <FiShoppingBag className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium truncate">
                    You&apos;re viewing the <span className="font-bold">{store}</span> store
                </span>
                <button
                    type="button"
                    onClick={exitStore}
                    className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-amber-900 flex-shrink-0"
                >
                    <FiX className="w-4 h-4" />
                    Exit
                </button>
            </div>
        </div>
    );
}
