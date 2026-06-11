import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import AdminModel from '../models/admin.model.js';
import { effectivePermissions, setHasPermission } from '../lib/permissions.js';
import { setRequestTenant } from '../tenancy/tenantContext.js';

const extractToken = (req) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim();
    return null;
};

const verify = (token) => {
    try {
        return jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') throw ApiError.unauthorized('Token expired');
        throw ApiError.unauthorized('Invalid token');
    }
};

// Owner accounts configured via ADMIN_EMAILS sign in through the email OTP
// flow, so their JWT carries `email` (not `sub`). They predate the
// username/password + role system and must be treated as full super-admins —
// otherwise every permission-gated route (e.g. the Profit report's
// analytics:read gate) would 403 for them.
const ENV_ADMIN_EMAILS = new Set(env.ADMIN_EMAILS || []);

// Verifies the JWT, then loads the live admin record so role/permission
// changes and deactivations take effect immediately (no stale-token access).
export const requireAuth = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Access denied. No token provided.');

    const decoded = verify(token);
    req.admin = decoded; // raw JWT payload (backward compatible)

    // ── Bind this request to the token's store (keystone) ────────────────────
    // On the shared domain there is no subdomain, so withTenant left the context
    // on the default (primary) store. The token carries the tenant the owner
    // actually belongs to — re-bind to it so the admin lookup below AND every
    // downstream query (products, orders, POS, …) scope to that store.
    //   • If a subdomain already resolved a host tenant (future), the token MUST
    //     match it — otherwise it's a session minted for a different store.
    //   • If the token predates multi-tenancy (no tenantId), leave the default.
    const tokenTenantId = decoded.tenantId ? String(decoded.tenantId) : null;
    const hostTenantId = req.tenant?._id ? String(req.tenant._id) : null;
    if (hostTenantId && tokenTenantId && hostTenantId !== tokenTenantId) {
        throw ApiError.forbidden('This session belongs to a different store.');
    }
    if (tokenTenantId) setRequestTenant(tokenTenantId);

    // Tokens minted by the username/password flow carry `sub` = admin id.
    if (decoded.sub) {
        const admin = await AdminModel.findById(decoded.sub).select('+permissions');
        if (!admin) throw ApiError.unauthorized('Account no longer exists');
        if (!admin.isActive) throw ApiError.forbidden('Account is deactivated');
        req.adminDoc = admin;
        req.permissions = effectivePermissions(admin);
    } else if (decoded.email) {
        // Legacy OTP / email flow. Resolve permissions so these accounts aren't
        // left permission-less (which would 403 every gated route).
        const email = String(decoded.email).toLowerCase();

        if (ENV_ADMIN_EMAILS.has(email)) {
            // Env owner allow-list — full super-admin access.
            req.admin.role = 'super-admin';
            req.permissions = new Set(['*']);
        } else {
            const admin = await AdminModel.findOne({ email }).select('+permissions');
            if (admin) {
                if (admin.isActive === false) throw ApiError.forbidden('Account is deactivated');
                req.adminDoc = admin;
                // Email admins created before roles existed default to the full
                // "admin" role (mirrors the model default) so their historical
                // access is preserved under the new permission system.
                req.permissions = effectivePermissions({
                    role: admin.role || 'admin',
                    permissions: admin.permissions,
                });
            } else {
                // Authenticated email with no matching record / allow-list entry.
                req.permissions = new Set();
            }
        }
    } else {
        req.permissions = new Set();
    }

    next();
});

// Role gate (kept for backward compatibility / coarse checks).
export const requireRole = (...allowedRoles) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.admin) throw ApiError.unauthorized();
        const role = req.adminDoc?.role || req.admin?.role;
        if (allowedRoles.length && !allowedRoles.includes(role)) {
            throw ApiError.forbidden('Insufficient permissions');
        }
        next();
    });

// Fine-grained gate. Requires ALL listed permissions. Super-admin and the
// "*" grant bypass every check.
export const requirePermission = (...required) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.admin) throw ApiError.unauthorized();
        const set = req.permissions || new Set();
        const missing = required.filter((p) => !setHasPermission(set, p));
        if (missing.length) {
            throw ApiError.forbidden(`Missing permission: ${missing.join(', ')}`);
        }
        next();
    });

// Fine-grained gate. Passes if the user holds ANY ONE of the listed
// permissions. Useful when several distinct grants should unlock the same
// action (e.g. order:write OR order:status can change an order's status).
export const requireAnyPermission = (...required) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.admin) throw ApiError.unauthorized();
        const set = req.permissions || new Set();
        const ok = required.some((p) => setHasPermission(set, p));
        if (!ok) {
            throw ApiError.forbidden(`Missing permission: one of ${required.join(', ')}`);
        }
        next();
    });

export default requireAuth;
