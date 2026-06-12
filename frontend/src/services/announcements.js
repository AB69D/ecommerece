import { authFetch } from "./api";

// Store-side, read-only: the active platform notices for the signed-in store.
// Shown as a banner in the store admin.
export const getMyAnnouncements = () => authFetch("/api/admin/announcements").then((r) => r.json());
