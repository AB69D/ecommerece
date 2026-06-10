"use client";
import { useEffect } from "react";

// Registers the service worker so the storefront/POS work as an installable PWA.
// Driven by the admin `features.pwa` flag: when off we proactively unregister
// any previously installed worker so toggling the flag fully disables offline
// behaviour rather than leaving a stale worker controlling the page.
export default function PwaRegister({ enabled }) {
    useEffect(() => {
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

        if (!enabled) {
            navigator.serviceWorker
                .getRegistrations()
                .then((regs) => regs.forEach((r) => r.unregister()))
                .catch(() => {});
            return;
        }

        const register = () => {
            navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
        };
        // Wait for the page to settle so the SW install doesn't compete with the
        // first render for bandwidth.
        if (document.readyState === "complete") register();
        else {
            window.addEventListener("load", register, { once: true });
            return () => window.removeEventListener("load", register);
        }
    }, [enabled]);

    return null;
}
