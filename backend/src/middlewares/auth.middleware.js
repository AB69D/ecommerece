import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../lib/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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

export const requireAuth = asyncHandler(async (req, _res, next) => {
    const token = extractToken(req);
    if (!token) throw ApiError.unauthorized('Access denied. No token provided.');
    req.admin = verify(token);
    next();
});

export const requireRole = (...allowedRoles) =>
    asyncHandler(async (req, _res, next) => {
        if (!req.admin) throw ApiError.unauthorized();
        if (allowedRoles.length && !allowedRoles.includes(req.admin.role)) {
            throw ApiError.forbidden('Insufficient permissions');
        }
        next();
    });

export default requireAuth;
