import { authFetch } from "./api";

const BASE = "/api/admin/coupon";
const jsonHeaders = { "Content-Type": "application/json" };

const qs = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") sp.append(k, v);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
};

// Admin CRUD (requires discount:* permissions).
export const listCoupons = (params) => authFetch(`${BASE}${qs(params)}`).then((r) => r.json());

export const createCoupon = (payload) =>
    authFetch(BASE, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

export const updateCoupon = (id, payload) =>
    authFetch(`${BASE}/${id}`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

export const deleteCoupon = (id) =>
    authFetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) => (r.status === 204 ? { success: true } : r.json()));

// Validate/preview a code (any authenticated staff, incl. POS cashiers).
export const validateCouponAdmin = (code, subtotal, channel = "pos") =>
    authFetch(`${BASE}/validate`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code, subtotal, channel }),
    }).then((r) => r.json());

// Public storefront validate/preview (unauthenticated).
export const validateCouponPublic = (code, subtotal, channel = "ecommerce") =>
    fetch(`/api/client/coupon/validate`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code, subtotal, channel }),
    }).then((r) => r.json());
