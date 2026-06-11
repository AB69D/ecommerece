import mongoose from 'mongoose';
import { ApiError } from '../lib/ApiError.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

const normalizeKnownError = (err) => {
    // multer rejections (file too large / too many files / wrong field) arrive
    // here as MulterError — surface them as clean 400s instead of opaque 500s.
    if (err?.name === 'MulterError') {
        const messages = {
            LIMIT_FILE_SIZE: 'File too large. Each image must be 8 MB or smaller.',
            LIMIT_FILE_COUNT: 'Too many files. Please upload fewer images.',
            LIMIT_UNEXPECTED_FILE: 'Unexpected file field in the upload.',
        };
        return ApiError.badRequest(messages[err.code] || 'File upload failed.');
    }
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
    const normalized = err instanceof ApiError ? err : normalizeKnownError(err) || err;
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
