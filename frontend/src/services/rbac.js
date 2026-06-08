import { authFetch } from "./api";

// Returns { groups, permissions, roles, rolePermissions } for rendering the
// permission matrix and role defaults in the admin UI.
export const getRbacCatalog = () =>
    authFetch("/api/admin/rbac/catalog").then((r) => r.json());
