import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import AdminModel from '../models/admin.model.js';
import { effectivePermissions, setHasPermission } from '../lib/permissions.js';

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

// Verifies the JWT, then loads the live admin record so role/permission
// changes and deactivations take effect immediately (no stale-token access).
export const requireAuth = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Access denied. No token provided.');

    const decoded = verify(token);
    req.admin = decoded; // raw JWT payload (backward compatible)

    // Tokens minted by the username/password flow carry `sub` = admin id.
    if (decoded.sub) {
        const admin = await AdminModel.findById(decoded.sub).select('+permissions');
        if (!admin) throw ApiError.unauthorized('Account no longer exists');
        if (!admin.isActive) throw ApiError.forbidden('Account is deactivated');
        req.adminDoc = admin;
        req.permissions = effectivePermissions(admin);
    } else {
        // Legacy OTP token (email only) — no DB record / permissions.
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

export default requireAuth;
