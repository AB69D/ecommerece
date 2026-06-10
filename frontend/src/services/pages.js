import { authFetch } from "./api";

const BASE = "/api/admin/page";
const jsonHeaders = { "Content-Type": "application/json" };

export const getPages = () => authFetch(BASE).then((r) => r.json());

export const getPage = (slug) => authFetch(`${BASE}/${slug}`).then((r) => r.json());

export const updatePage = (slug, payload) =>
    authFetch(`${BASE}/${slug}`, {
        method: "PUT",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    }).then((r) => r.json());
