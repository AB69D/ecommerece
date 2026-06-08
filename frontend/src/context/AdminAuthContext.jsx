"use client";
import { createContext, useContext } from "react";
import { hasPermission as check } from "@/lib/permissions";

// Provides the current admin (`me`) and a permission checker to every admin
// page. Populated by AdminLayout after it loads /api/admin/auth/me.
export const AdminAuthContext = createContext({
    me: null,
    loading: true,
    can: () => false,
    refresh: () => {},
});

export const useAdminAuth = () => useContext(AdminAuthContext);

export const buildCan = (me) => (perm) => check(me, perm);
