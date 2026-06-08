import { authFetch } from "@/services/api";

// Admin customer directory API helpers.
export async function getOrderedCustomers(search = "") {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await authFetch(`/api/admin/customer/ordered${qs}`);
    const json = await res.json();
    if (!json?.success) throw new Error(json?.message || "Failed to load customers");
    return json.data;
}

export async function getAbandonedCheckouts(search = "") {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await authFetch(`/api/admin/customer/abandoned${qs}`);
    const json = await res.json();
    if (!json?.success) throw new Error(json?.message || "Failed to load abandoned checkouts");
    return json.data;
}

export async function getCustomerStats() {
    const res = await authFetch(`/api/admin/customer/stats`);
    const json = await res.json();
    if (!json?.success) throw new Error(json?.message || "Failed to load stats");
    return json.data;
}
