"use client";
import { createContext, useContext, useEffect, useState } from "react";

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

    return <CurrencyContext.Provider value={currency}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
    return useContext(CurrencyContext);
}
