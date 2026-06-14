"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchMe, persistSession, logout as clearSession } from "@/services/customerAuth";

// Provides the signed-in shopper (`customer`) and auth actions to the whole
// storefront. Bootstrapped once on mount from /api/client/auth/me; most
// visitors are anonymous, so a missing/expired token simply resolves to
// customer: null without any redirect.
const CustomerAuthContext = createContext({
    customer: null,
    loading: true,
    login: () => {},
    logout: () => {},
    refresh: async () => {},
});

export const useCustomerAuth = () => useContext(CustomerAuthContext);

// Sign-in/out swaps the active guestId (cart, wishlist and order lookups are
// all keyed off it), so nudge the navbar badges to recompute against the new
// identity.
const notifyStorefront = () => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("cart-updated"));
    window.dispatchEvent(new Event("wishlist-updated"));
};

export function CustomerAuthProvider({ children }) {
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const { store = "" } = useParams() || {};

    const refresh = useCallback(async () => {
        try {
            const res = await fetchMe(store);
            setCustomer(res?.success && res.data?.customer ? res.data.customer : null);
        } catch {
            setCustomer(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    // Called by the login/register forms after a successful credential call.
    const login = useCallback((token, nextCustomer) => {
        persistSession(token, nextCustomer);
        setCustomer(nextCustomer);
        notifyStorefront();
    }, []);

    const logout = useCallback(() => {
        clearSession();
        setCustomer(null);
        notifyStorefront();
    }, []);

    return (
        <CustomerAuthContext.Provider value={{ customer, loading, login, logout, refresh }}>
            {children}
        </CustomerAuthContext.Provider>
    );
}
