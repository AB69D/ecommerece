import { authFetch } from "./api";

const BASE = "/api/admin/admins";
const json = (r) => r.json();
const jsonHeaders = { "Content-Type": "application/json" };

export const listAdminUsers = () => authFetch(BASE).then(json);

export const getAdminUser = (id) => authFetch(`${BASE}/${id}`).then(json);

export const createAdminUser = (payload) =>
    authFetch(BASE, { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) }).then(json);

export const updateAdminUser = (id, payload) =>
    authFetch(`${BASE}/${id}`, { method: "PATCH", headers: jsonHeaders, body: JSON.stringify(payload) }).then(json);

export const resetAdminPassword = (id, password) =>
    authFetch(`${BASE}/${id}/reset-password`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ password }),
    }).then(json);

export const deleteAdminUser = (id) =>
    authFetch(`${BASE}/${id}`, { method: "DELETE" }).then(json);

export const changeOwnPassword = (currentPassword, newPassword) =>
    authFetch(`${BASE}/me/password`, {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ currentPassword, newPassword }),
    }).then(json);
