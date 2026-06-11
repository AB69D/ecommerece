import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import CustomerModel from '../models/customer.model.js';
import { setRequestTenant } from '../tenancy/tenantContext.js';

const extractToken = (req) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim();
    return null;
};

// Customer JWTs carry `sub` = customer id and `type: 'customer'`. The `type`
// claim keeps them distinct from admin tokens (both are signed with the same
// JWT_SECRET) so an admin token can never be replayed against customer routes
// and vice-versa.
const decodeCustomer = (token) => {
    let decoded;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw ApiError.unauthorized('Your session has expired. Please sign in again.');
        }
        throw ApiError.unauthorized('Invalid session. Please sign in again.');
    }
    if (decoded.type !== 'customer' || !decoded.sub) {
        throw ApiError.unauthorized('Invalid session. Please sign in again.');
    }
    return decoded;
};

// Bind the request to the store the customer belongs to (keystone). On the
// shared domain there is no subdomain, so the context sits on the default store;
// the token's tenantId moves it to the customer's own store so the re-load below
// AND every downstream query (cart, orders, …) scope correctly. If a subdomain
// already resolved a host tenant (future), the token must match it.
const bindCustomerTenant = (req, decoded) => {
    const tokenTenantId = decoded.tenantId ? String(decoded.tenantId) : null;
    const hostTenantId = req.tenant?._id ? String(req.tenant._id) : null;
    if (hostTenantId && tokenTenantId && hostTenantId !== tokenTenantId) {
        throw ApiError.forbidden('This session belongs to a different store.');
    }
    if (tokenTenantId) setRequestTenant(tokenTenantId);
};

// Re-loads the live customer record so a deactivation or deletion takes effect
// immediately (no stale-token access).
const loadCustomer = async (decoded) => {
    const customer = await CustomerModel.findById(decoded.sub);
    if (!customer) throw ApiError.unauthorized('Account no longer exists.');
    if (!customer.isActive) throw ApiError.forbidden('This account has been deactivated.');
    return customer;
};

// Hard gate: rejects with 401/403 unless a valid customer token is present.
export const requireCustomer = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Please sign in to continue.');
    const decoded = decodeCustomer(token);
    bindCustomerTenant(req, decoded);
    req.customer = await loadCustomer(decoded);
    next();
});

// Soft gate: attaches req.customer when a valid token is present but NEVER
// rejects. Used by routes that must serve both guests and signed-in members
// (e.g. order creation stamps customerId only when logged in).
export const optionalCustomer = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) return next();
    try {
        const decoded = decodeCustomer(token);
        bindCustomerTenant(req, decoded);
        req.customer = await loadCustomer(decoded);
    } catch {
        // Treat an invalid/expired token as an anonymous guest rather than failing.
    }
    next();
});

export default requireCustomer;
