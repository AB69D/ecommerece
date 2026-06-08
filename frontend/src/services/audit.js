import { authFetch } from "./api";

export const listAuditLogs = (params = {}) => {
    const entries = Object.entries(params).filter(([, v]) => v !== "" && v != null);
    const qs = new URLSearchParams(entries).toString();
    return authFetch(`/api/admin/audit-logs${qs ? `?${qs}` : ""}`).then((r) => r.json());
};

export const getAuditStats = () =>
    authFetch("/api/admin/audit-logs/stats").then((r) => r.json());
