import { authFetch } from "./api";

const BASE = "/api/admin/flash-sale";
const jsonHeaders = { "Content-Type": "application/json" };

const qs = (params) => {
    const sp = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") sp.append(k, v);
    });
    const s = sp.toString();
    return s ? `?${s}` : "";
};

export const listFlashSales = (params) =>
    authFetch(`${BASE}${qs(params)}`).then((r) => r.json());

export const getFlashSale = (id) =>
    authFetch(`${BASE}/${id}`).then((r) => r.json());

export const createFlashSale = (payload) =>
    authFetch(BASE, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }).then((r) => r.json());

export const updateFlashSale = (id, payload) =>
    authFetch(`${BASE}/${id}`, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }).then((r) => r.json());

export const deleteFlashSale = (id) =>
    authFetch(`${BASE}/${id}`, { method: "DELETE" }).then((r) =>
        r.status === 204 ? { success: true } : r.json()
    );

// Public storefront: active flash sales (no auth).
export const fetchActiveFlashSales = (store = "") =>
    fetch(`/api/client/flash-sale/active`, {
        headers: store ? { "X-Tenant": store } : {},
    }).then((r) => r.json());
