// Permission helpers for the POS terminal. `perms` is the effectivePermissions
// array returned by /api/admin/auth/me.

const has = (perms, p) =>
    Array.isArray(perms) && (perms.includes("*") || perms.includes("pos:*") || perms.includes(p));

// Can ring up sales / process returns.
export const canSell = (perms) => has(perms, "pos:sell");

// Can view reports / sales history.
export const canRead = (perms) => has(perms, "pos:read");

// Has any POS capability at all (gate for the whole terminal).
export const hasPosAccess = (perms) => canSell(perms) || canRead(perms);

// Manage scope: sees every seller's data (admins / pos:manage).
export const canManage = (perms) => has(perms, "pos:manage");
