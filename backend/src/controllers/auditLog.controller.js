import mongoose from 'mongoose';
import AuditLogModel from '../models/auditLog.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';

const clampInt = (val, def, min, max) => {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return def;
    return Math.min(Math.max(n, min), max);
};

// GET /api/admin/audit-logs
// Filters: page, limit, action, resource, actor, success, q, from, to
export const listAuditLogs = asyncHandler(async (req, res) => {
    const page = clampInt(req.query.page, 1, 1, 100000);
    const limit = clampInt(req.query.limit, 25, 1, 200);

    const filter = {};
    if (req.query.action) filter.action = req.query.action;
    if (req.query.resource) filter.resource = req.query.resource;
    if (req.query.actor) filter['actor.username'] = req.query.actor;
    if (req.query.success === 'true') filter.success = true;
    if (req.query.success === 'false') filter.success = false;
    if (req.query.q) {
        const rx = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        filter.$or = [{ message: rx }, { path: rx }, { action: rx }];
    }
    if (req.query.from || req.query.to) {
        filter.createdAt = {};
        if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
        if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const [items, total] = await Promise.all([
        AuditLogModel.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        AuditLogModel.countDocuments(filter),
    ]);

    return ok(res, {
        items,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Audit logs');
});

// GET /api/admin/audit-logs/stats — quick summary for dashboards.
export const auditStats = asyncHandler(async (req, res) => {
    const tenantFilter = { tenantId: new mongoose.Types.ObjectId(req.tenantId) };
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [total, last24h, byAction] = await Promise.all([
        AuditLogModel.countDocuments(tenantFilter),
        AuditLogModel.countDocuments({ ...tenantFilter, createdAt: { $gte: since } }),
        AuditLogModel.aggregate([
            { $match: tenantFilter },
            { $group: { _id: '$action', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
        ]),
    ]);
    return ok(res, { total, last24h, topActions: byAction }, 'Audit stats');
});
