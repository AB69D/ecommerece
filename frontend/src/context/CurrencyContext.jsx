"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";

// Provides the admin-configurable currency symbol/code to the whole storefront.
// The root layout fetches site settings server-side and seeds `initial*` so the
// first paint already shows the correct symbol (no flash); we also re-check on
// the client so a freshly-changed symbol shows without a full reload.
const CurrencyContext = createContext({ symbol: "$", code: "USD" });

export function CurrencyProvider({ initialSymbol = "$", initialCode = "USD", children }) {
    const [currency, setCurrency] = useState({ symbol: initialSymbol || "$", code: initialCode || "USD" });

    useEffect(() => {
        let active = true;
        fetch("/api/client/site-settings")
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                const d = j?.data;
                if (active && d && (d.currencySymbol || d.currencyCode)) {
                    setCurrency({ symbol: d.currencySymbol || "$", code: d.currencyCode || "USD" });
                }
            })
            .catch(() => {});
        return () => {
            active = false;
        };
    }, []);

    // Live, same-tab updates: when the admin saves a new symbol in Site Settings,
    // that page dispatches `currency-updated` so every surface (admin tables, POS,
    // storefront) re-renders with the new symbol without a full reload.
    useEffect(() => {
        const onUpdate = (e) => {
            const d = e?.detail;
            if (d && (d.symbol || d.code)) {
                setCurrency((prev) => ({ symbol: d.symbol || prev.symbol, code: d.code || prev.code }));
            }
        };
        window.addEventListener("currency-updated", onUpdate);
        return () => window.removeEventListener("currency-updated", onUpdate);
    }, []);

    return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    return useContext(CurrencyContext);
}

// Returns a `money(value)` formatter bound to the admin-configured currency
// symbol. One source of truth for every price across the storefront, admin
// panel and POS — change the symbol in Site Settings and it follows everywhere.
// The function identity is stable per-symbol, so it's safe to pass straight to
// memoised chart components (e.g. `formatValue={money}`).
export function useMoney() {
    const { symbol } = useCurrency();
    return useCallback(
        (v) => `${symbol}${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        [symbol],
    );
}
