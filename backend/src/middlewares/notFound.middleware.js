import { ApiError } from '../lib/ApiError.js';

export const notFound = (req, _res, next) => {
    next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};
