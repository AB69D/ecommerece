import { authFetch } from "./api";

export const getDashboardOverview = (days = 30) =>
    authFetch(`/api/admin/analytics/overview?days=${days}`).then((r) => r.json());

// Cost / profit / margin report. channel: 'all' | 'pos' | 'ecommerce'.
export const getProfitReport = (days = 30, channel = "all") =>
    authFetch(`/api/admin/analytics/profit?days=${days}&channel=${channel}`).then((r) => r.json());
