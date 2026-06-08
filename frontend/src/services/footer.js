import { authFetch } from "./api";

const BASE = "/api/admin/footer";
const jsonHeaders = { "Content-Type": "application/json" };

export const getFooterSettings = () => authFetch(BASE).then((r) => r.json());

export const updateFooterSettings = (payload) =>
    authFetch(BASE, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) }).then((r) => r.json());
