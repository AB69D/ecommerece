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

// status is optional: '' | 'pending' | 'approved' | 'suspended' | 'rejected'.
export const listTenants = (status = "") => {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return authFetch(`${BASE}/tenants${qs}`).then(json);
};

export const getTenant = (id) => authFetch(`${BASE}/tenants/${id}`).then(json);

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
