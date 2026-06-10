// ---------------------------------------------------------------
// Central permission catalog + role -> permission defaults.
//
// Permission format:  "<resource>:<action>"  e.g. "product:write".
// The wildcard "*" grants everything (super-admin).
//
// A resource may also use the wildcard action "<resource>:*" to grant
// every action on that resource.
//
// Effective permissions for an admin =
//     (defaults for their role)  ∪  (their custom `permissions` grants)
//
// This catalog is intentionally broad so later phases (PIM, OMS, B2B,
// payments, integrations, analytics...) can reference permissions that
// already exist without touching auth wiring.
// ---------------------------------------------------------------

export const ACTIONS = Object.freeze({
    READ: 'read',
    WRITE: 'write',
    DELETE: 'delete',
    MANAGE: 'manage', // elevated: settings/config level changes
});

// Resource groups -> human label (used by the admin UI to render a matrix).
export const PERMISSION_GROUPS = Object.freeze([
    {
        key: 'catalog',
        label: 'Catalog',
        resources: [
            { key: 'product', label: 'Products', actions: ['read', 'write', 'delete'] },
            { key: 'category', label: 'Categories', actions: ['read', 'write', 'delete'] },
            { key: 'brand', label: 'Brands', actions: ['read', 'write', 'delete'] },
            { key: 'review', label: 'Reviews', actions: ['read', 'write', 'delete'] },
            { key: 'discount', label: 'Discounts / Promotions', actions: ['read', 'write', 'delete'] },
        ],
    },
    {
        key: 'sales',
        label: 'Sales & Operations',
        resources: [
            { key: 'order', label: 'Orders', actions: ['read', 'write', 'status', 'delete'] },
            { key: 'fulfillment', label: 'Fulfillment / Shipments', actions: ['read', 'write'] },
            { key: 'inventory', label: 'Inventory / Stock', actions: ['read', 'write'] },
            { key: 'vendor', label: 'Vendors', actions: ['read', 'write', 'delete'] },
            { key: 'customer', label: 'Customers', actions: ['read', 'write', 'delete'] },
            { key: 'payment', label: 'Payments / Refunds', actions: ['read', 'write', 'manage'] },
            { key: 'tax', label: 'Tax rules', actions: ['read', 'write', 'manage'] },
        ],
    },
    {
        key: 'b2b',
        label: 'B2B',
        resources: [
            { key: 'company', label: 'Companies', actions: ['read', 'write', 'delete'] },
            { key: 'pricelist', label: 'Price lists / Catalogs', actions: ['read', 'write', 'delete'] },
            { key: 'quote', label: 'Quotes', actions: ['read', 'write', 'delete'] },
        ],
    },
    {
        key: 'content',
        label: 'Content & Storefront',
        resources: [
            { key: 'content', label: 'Site settings / Footer / Nav', actions: ['read', 'write'] },
            { key: 'header', label: 'Headers / Banners', actions: ['read', 'write', 'delete'] },
        ],
    },
    {
        key: 'pos',
        label: 'Point of Sale',
        resources: [
            // pos:sell  -> ring up retail / wholesale sales and returns
            // pos:read  -> view own sales history & reports
            // pos:manage-> manage POS settings / all sellers' data
            { key: 'pos', label: 'POS Terminal', actions: ['read', 'sell', 'manage'] },
        ],
    },
    {
        key: 'insights',
        label: 'Insights',
        resources: [
            { key: 'analytics', label: 'Analytics & Reports', actions: ['read'] },
        ],
    },
    {
        key: 'admin',
        label: 'Administration',
        resources: [
            { key: 'user', label: 'Admin users', actions: ['read', 'write', 'delete'] },
            { key: 'role', label: 'Roles & permissions', actions: ['read', 'manage'] },
            { key: 'audit', label: 'Audit logs', actions: ['read'] },
            { key: 'integration', label: 'Integrations (Stripe, n8n, AI...)', actions: ['read', 'manage'] },
            { key: 'compliance', label: 'GDPR / Data requests', actions: ['read', 'manage'] },
            { key: 'settings', label: 'System settings', actions: ['read', 'manage'] },
        ],
    },
]);

// Flat list of every valid permission string, derived from the groups.
export const ALL_PERMISSIONS = Object.freeze(
    PERMISSION_GROUPS.flatMap((g) =>
        g.resources.flatMap((r) => r.actions.map((a) => `${r.key}:${a}`)),
    ),
);

const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS);

export const isValidPermission = (perm) =>
    perm === '*' || ALL_PERMISSIONS_SET.has(perm);

// ---------------------------------------------------------------
// Role definitions. Order = privilege descending.
// ---------------------------------------------------------------
export const ROLES = Object.freeze([
    'super-admin',
    'admin',
    'moderator',
    'salesman',
]);

const readEverything = ALL_PERMISSIONS.filter((p) => p.endsWith(':read'));

// Resources a moderator must NOT see at all (admin-only areas + POS).
const MODERATOR_HIDDEN_RESOURCES = new Set([
    'user', 'role', 'audit', 'integration', 'compliance', 'settings', 'pos',
]);

export const ROLE_PERMISSIONS = Object.freeze({
    // Full access — bypasses the matrix entirely.
    'super-admin': ['*'],

    // Everything except role administration & integration secrets.
    admin: ALL_PERMISSIONS.filter(
        (p) => !p.startsWith('role:') && p !== 'integration:manage' && p !== 'settings:manage',
    ),

    // Read-only across the storefront/operations data by default. They cannot
    // see the admin-only areas (users, roles, audit, settings) or the POS.
    // Write access (e.g. product:write, order:status) is granted per-user via
    // the tick-mark permission matrix on top of these defaults.
    moderator: readEverything.filter(
        (p) => !MODERATOR_HIDDEN_RESOURCES.has(p.split(':')[0]),
    ),

    // In-store seller / cashier: ring up sales & returns at the POS terminal,
    // read the catalog, and view the order list with the ability to advance an
    // order's status only (no edit / delete / create from the admin panel).
    salesman: [
        'pos:sell',
        'pos:read',
        'product:read',
        'category:read',
        'inventory:read',
        'order:read',
        'order:status',
    ],
});

// ---------------------------------------------------------------
// Resolution helpers.
// ---------------------------------------------------------------

// Compute the full effective permission set for an admin document.
export const effectivePermissions = (admin) => {
    if (!admin) return new Set();
    const base = ROLE_PERMISSIONS[admin.role] || [];
    const custom = Array.isArray(admin.permissions) ? admin.permissions : [];
    return new Set([...base, ...custom]);
};

// Does an effective set satisfy a single required permission?
export const setHasPermission = (set, required) => {
    if (!set || set.size === 0) return false;
    if (set.has('*')) return true;
    if (set.has(required)) return true;
    // wildcard action: "product:*" satisfies "product:read"
    const resource = required.split(':')[0];
    if (set.has(`${resource}:*`)) return true;
    return false;
};

export const adminHasPermission = (admin, required) =>
    setHasPermission(effectivePermissions(admin), required);
