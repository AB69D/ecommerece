import { authFetch } from "./api";

// Platform (cross-tenant) API — store onboarding + super-admin fleet management.
// Mirrors backend/src/routes/platform.route.js. All envelopes are
// { success, error, message, data }.
const BASE = "/api/platform";
const json = (r) => r.json();
const jsonHeaders = { "Content-Type": "application/json" };

// PUBLIC store registration. Uses a plain fetch (NOT authFetch): a prospective
// owner has no admin token, and a 401 here must NOT bounce them to /admin/login.
// payload: { businessName, subdomain, owner:{ fullName, email, username, password },
//            contact:{ phone, address } }
export const registerStore = async (payload) => {
    const res = await fetch(`${BASE}/register`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });
    return res.json();
};

// ── Super-admin only (env ADMIN_EMAILS allow-list). authFetch attaches the
// admin token; the backend's requireSuperAdmin re-checks the email claim. ──────

// Platform owner home dashboard: every store with order count + revenue + totals.
export const getOverview = () => authFetch(`${BASE}/overview`).then(json);

// status is optional: '' | 'pending' | 'approved' | 'suspended' | 'rejected'.
export const listTenants = (status = "") => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return authFetch(`${BASE}/tenants${qs}`).then(json);
};

export const getTenant = (id) => authFetch(`${BASE}/tenants/${id}`).then(json);

// Every staff account belonging to a store (owner + admins + POS sellers).
export const listTenantUsers = (id) => authFetch(`${BASE}/tenants/${id}/users`).then(json);

export const approveTenant = (id) =>
    authFetch(`${BASE}/tenants/${id}/approve`, { method: "POST" }).then(json);

// Toggle endpoint: suspends an approved store, or resumes a suspended one.
export const suspendTenant = (id, reason = "") =>
    authFetch(`${BASE}/tenants/${id}/suspend`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ reason }),
    }).then(json);

export const rejectTenant = (id, reason = "") =>
    authFetch(`${BASE}/tenants/${id}/reject`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ reason }),
    }).then(json);

// "Log in as" a store's owner — returns { token, store } so the UI can swap the
// admin token and step into that store's panel.
export const impersonateStore = (id) =>
    authFetch(`${BASE}/tenants/${id}/impersonate`, { method: "POST" }).then(json);

// ── Owner management ─────────────────────────────────────────────────────────
// Platform owners (cross-tenant super-admins).
export const listOwners = () => authFetch(`${BASE}/owners`).then(json);

export const createOwner = (payload) =>
    authFetch(`${BASE}/owners`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }).then(json);

export const revokeOwner = (id) =>
    authFetch(`${BASE}/owners/${id}/revoke`, { method: "POST" }).then(json);

// Store owners (per-tenant owner accounts).
export const listStoreOwners = () => authFetch(`${BASE}/store-owners`).then(json);

// Shared account ops, keyed by the admin's id (works for either surface).
export const resetAdminPassword = (id, password) =>
    authFetch(`${BASE}/admins/${id}/password`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ password }),
    }).then(json);

export const toggleAdminActive = (id) =>
    authFetch(`${BASE}/admins/${id}/toggle`, { method: "POST" }).then(json);
