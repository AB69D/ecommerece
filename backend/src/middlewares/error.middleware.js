import mongoose from 'mongoose';
import { ApiError } from '../lib/ApiError.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

const fromMongoose = (err) => {
    if (err instanceof mongoose.Error.ValidationError) {
        const details = Object.values(err.errors).map((e) => ({
            path: e.path,
            message: e.message,
            kind: e.kind,
        }));
        return ApiError.unprocessable('Validation failed', details);
    }
    if (err instanceof mongoose.Error.CastError) {
        return ApiError.badRequest(`Invalid ${err.path}: ${err.value}`);
    }
    if (err?.code === 11000) {
        const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';
        return ApiError.conflict(`${field} already exists`);
    }
    return null;
};

export const errorHandler = (err, req, res, _next) => {
    const normalized = err instanceof ApiError ? err : fromMongoose(err) || err;
    const statusCode = normalized.statusCode || 500;
    const isOperational = normalized instanceof ApiError;

    if (statusCode >= 500 || !isOperational) {
        logger.error({ err: normalized, path: req.originalUrl, method: req.method }, 'Unhandled error');
    } else {
        logger.warn({ statusCode, path: req.originalUrl, message: normalized.message }, 'Request rejected');
    }

    const payload = {
        success: false,
        message: isOperational ? normalized.message : 'Internal server error',
    };
    if (normalized.details) payload.details = normalized.details;
    if (env.NODE_ENV !== 'production' && !isOperational) payload.stack = normalized.stack;

    res.status(statusCode).json(payload);
};
