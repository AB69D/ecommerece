import { ApiError } from '../lib/ApiError.js';
import { env } from '../config/env.js';

// ── requireTenant middleware ─────────────────────────────────────────────────
// Enforces that a tenant was explicitly resolved for the current request.
// Mount this AFTER resolveTenant + withTenant, on any route prefix that MUST
// be tenant-scoped (i.e. /api/client/* and /api/admin/* in multi-tenant mode).
//
// WHY: resolveTenant falls through silently when no X-Tenant header / subdomain
// is present, letting the tenantPlugin defaultTenantId carry the request.  That
// "helpful fallback" is correct in single-tenant mode but is a silent data leak
// in multi-tenant mode: a request missing a tenant signal would be answered with
// the PRIMARY tenant's data rather than rejected.
//
// WHEN ENFORCEMENT IS OFF (TENANT_ENFORCEMENT=false): this middleware is a
// no-op, so the dev / single-tenant interim is unaffected.
//
// WHEN ENFORCEMENT IS ON (TENANT_ENFORCEMENT=true):
//   • req.tenant._id is present  → pass through (tenant was positively resolved)
//   • req.tenant._id is absent   → 400 Bad Request
//     The caller (storefront Next.js middleware, mobile app) is expected to
//     forward the X-Tenant header on EVERY request.  A missing header is a
//     developer / integration bug, so 400 is the correct status.
//
// SYSTEM-CONTEXT routes (/api/platform, health checks) are mounted BEFORE this
// middleware in server.js and never reach it, so they are unaffected.

export const requireTenant = (req, _res, next) => {
    if (!env.TENANT_ENFORCEMENT) return next();

    const tenantId = req.tenant?._id || req.tenantId || null;
    if (!tenantId) {
        return next(
            ApiError.badRequest(
                'Missing tenant. Include the X-Tenant header with the store subdomain.',
            ),
        );
    }
    return next();
};

// Named export so server.js imports are clear:
//   import { requireTenant } from './tenancy/requireTenant.js';
export default requireTenant;
