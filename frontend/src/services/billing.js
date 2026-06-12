import { authFetch } from "./api";

// A store's view of its OWN plan, usage and balance. Read-only and scoped to the
// signed-in store (the backend reads it from the admin token's tenantId).
export const getMyBilling = () => authFetch("/api/admin/billing").then((r) => r.json());
