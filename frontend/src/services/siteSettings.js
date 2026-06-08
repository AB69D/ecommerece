import { authFetch } from "./api";

const BASE = "/api/admin/site-settings";
const jsonHeaders = { "Content-Type": "application/json" };

export const getSiteSettings = () => authFetch(BASE).then((r) => r.json());

export const updateSiteSettings = (payload) =>
    authFetch(BASE, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());

// Multipart upload — do NOT set Content-Type, the browser adds the boundary.
export const uploadSiteImage = (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return authFetch(`${BASE}/upload`, { method: "POST", body: fd }).then((r) => r.json());
};
