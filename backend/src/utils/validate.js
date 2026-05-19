import { ZodError } from 'zod';
import { ApiError } from '../lib/ApiError.js';

const formatIssues = (err) =>
    err.issues.map((i) => ({ path: i.path.join('.'), message: i.message, code: i.code }));

export const validate = (schemas) => (req, _res, next) => {
    try {
        if (schemas.body) req.body = schemas.body.parse(req.body);
        if (schemas.query) req.query = schemas.query.parse(req.query);
        if (schemas.params) req.params = schemas.params.parse(req.params);
        next();
    } catch (err) {
        if (err instanceof ZodError) {
            return next(ApiError.unprocessable('Validation failed', formatIssues(err)));
        }
        next(err);
    }
};
