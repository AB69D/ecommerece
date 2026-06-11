// Permission helpers for the POS terminal. `perms` is the effectivePermissions
// array returned by /api/admin/auth/me.

const has = (perms, p) =>
    Array.isArray(perms) && (perms.includes("*") || perms.includes("pos:*") || perms.includes(p));

// Generic check honoring "*", exact match, and "<resource>:*" wildcards.
const hasPerm = (perms, p) => {
    if (!Array.isArray(perms)) return false;
    if (perms.includes("*") || perms.includes(p)) return true;
    const resource = p.split(":")[0];
    return perms.includes(`${resource}:*`);
};

// Can ring up sales / process returns.
export const canSell = (perms) => has(perms, "pos:sell");

// Can view reports / sales history.
export const canRead = (perms) => has(perms, "pos:read");

// Has any POS capability at all (gate for the whole terminal).
export const hasPosAccess = (perms) => canSell(perms) || canRead(perms);

// Manage scope: sees every seller's data (admins / pos:manage).
export const canManage = (perms) => has(perms, "pos:manage");

// Can view the order list inside the POS (salesman / admin).
export const canReadOrders = (perms) => hasPerm(perms, "order:read");

// Can advance an order's status — but not edit/create/delete it.
export const canChangeOrderStatus = (perms) =>
    hasPerm(perms, "order:write") || hasPerm(perms, "order:status");
