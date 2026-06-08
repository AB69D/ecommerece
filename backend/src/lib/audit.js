import AuditLogModel from '../models/auditLog.model.js';
import { logger } from './logger.js';

// Persist a single audit entry. Never throws — auditing must not break a
// request. Failures are logged and swallowed.
export const writeAudit = async (entry) => {
    try {
        await AuditLogModel.create(entry);
    } catch (err) {
        logger.error({ err }, 'Failed to write audit log');
    }
};

const trimUA = (ua) => (ua ? String(ua).slice(0, 300) : '');

// Express middleware. Attaches `req.audit(data)` so controllers can enrich
// the entry, then records every state-changing admin request on response
// finish. GET requests and the auth router are skipped (auth is logged
// explicitly inside its controller).
export const auditMutations = (req, res, next) => {
    req.auditData = null;
    req.audit = (data = {}) => {
        req.auditData = { ...(req.auditData || {}), ...data };
    };

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
    const isAdminPath = req.path.startsWith('/api/admin') || req.originalUrl.startsWith('/api/admin');
    const isAuthPath = req.originalUrl.startsWith('/api/admin/auth');

    if (!isMutation || !isAdminPath || isAuthPath) {
        return next();
    }

    res.on('finish', () => {
        const actor = req.adminDoc
            ? { id: req.adminDoc._id, username: req.adminDoc.username, role: req.adminDoc.role }
            : { username: req.admin?.username || 'unknown', role: req.admin?.role || '' };

        const extra = req.auditData || {};
        writeAudit({
            actor,
            action: extra.action || `${req.method} ${req.originalUrl.split('?')[0]}`,
            resource: extra.resource || '',
            resourceId: extra.resourceId ? String(extra.resourceId) : '',
            method: req.method,
            path: req.originalUrl.split('?')[0],
            statusCode: res.statusCode,
            ip: req.ip || '',
            userAgent: trimUA(req.headers['user-agent']),
            message: extra.message || '',
            before: extra.before,
            after: extra.after,
            meta: extra.meta,
            success: res.statusCode < 400,
        });
    });

    next();
};
