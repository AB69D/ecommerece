import { AsyncLocalStorage } from 'node:async_hooks';

// ── Request-scoped tenant context ───────────────────────────────────────────
// Node's AsyncLocalStorage carries "which tenant is this request for?" through
// the whole async call chain (middleware -> controller -> Mongoose query)
// WITHOUT threading a tenantId argument through every function. The tenant
// scoping plugin (tenantPlugin.js) reads this store to auto-filter queries.
//
// A stored context is one of:
//   { tenantId: <ObjectId>, system: false }  — a normal tenant request
//   { tenantId: null,       system: true  }  — a platform/cross-tenant op
//                                               (super-admin, migrations, seeds)
// No store at all => no tenant bound (the plugin decides what to do based on
// the TENANT_ENFORCEMENT flag).

export const tenantStore = new AsyncLocalStorage();

// ── Default (fallback) tenant ───────────────────────────────────────────────
// During the single-tenant interim (after Phase 1 partitions the data but
// before Phase 2 subdomain routing resolves a tenant per request), there is no
// tenant in the async store. To keep every read scoped and every write stamped,
// the plugin falls back to this default — set to the primary ("tenant zero")
// at bootstrap. It is REMOVED once real per-request resolution is live and
// multiple tenants exist, so a missing context can no longer silently map to
// the primary tenant.
let defaultTenantId = null;
export const setDefaultTenantId = (id) => { defaultTenantId = id || null; };
export const getDefaultTenantId = () => defaultTenantId;

// Raw store accessor (rarely needed directly).
export const getStore = () => tenantStore.getStore() || null;

// The current tenant's id, or null if none / system context.
export const getTenantId = () => {
    const store = tenantStore.getStore();
    return store && store.tenantId ? store.tenantId : null;
};

// The tenant the plugin should actually use: the request-scoped tenant if set,
// otherwise the default (single-tenant interim) tenant. Null only if neither
// is available (then enforcement decides: throw vs no-op).
export const getEffectiveTenantId = () => getTenantId() || defaultTenantId;

// True when running in an intentional cross-tenant (platform) context. The
// plugin uses this to SKIP auto-scoping for super-admin analytics, the startup
// role migration, the tenancy bootstrap, and the Phase 1 back-fill.
export const isSystemContext = () => {
    const store = tenantStore.getStore();
    return !!(store && store.system);
};

// Run `fn` inside an explicit platform/system context (un-scoped, cross-tenant).
// Returns whatever `fn` returns (await it if `fn` is async).
export const runAsSystem = (fn) => tenantStore.run({ tenantId: null, system: true }, fn);

// Run `fn` scoped to a specific tenant. Used by background jobs and any code
// that must operate as one tenant outside the HTTP request path.
export const runAsTenant = (tenantId, fn) =>
    tenantStore.run({ tenantId, system: false }, fn);

// Express middleware: bind the rest of the request to the resolved tenant.
// Expects an upstream resolver to have set `req.tenant` (or `req.tenantId`).
// Mounted in Phase 2 once subdomain resolution is live; harmless to import now.
export const withTenant = (req, _res, next) => {
    const tenantId = (req.tenant && req.tenant._id) || req.tenantId || null;
    tenantStore.run({ tenantId, system: false }, () => next());
};
