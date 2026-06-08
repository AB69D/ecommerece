import { authFetch } from "./api";

export const getDashboardOverview = (days = 30) =>
    authFetch(`/api/admin/analytics/overview?days=${days}`).then((r) => r.json());
