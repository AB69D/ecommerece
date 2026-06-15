import NotificationLog from '../models/notificationLog.model.js';
import { logger } from '../lib/logger.js';

// ── GET /api/admin/notifications ─────────────────────────────────────────────
//
// Returns the most recent notification attempts for this tenant so admins can
// see whether their customers received WhatsApp / email messages.
//
// Query params (all optional):
//   page    — 1-based page number (default 1)
//   limit   — records per page (default 30, max 100)
//   type    — filter by channel: 'whatsapp' | 'email'
//   status  — filter by outcome: 'sent' | 'failed' | 'skipped'
//   orderId — filter by specific order

export const listNotificationsController = async (req, res) => {
    try {
        let { page = 1, limit = 30, type, status, orderId } = req.query;

        page = Math.max(1, parseInt(page, 10) || 1);
        limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));

        const query = {};
        if (type && ['whatsapp', 'email'].includes(type)) query.type = type;
        if (status && ['sent', 'failed', 'skipped'].includes(status)) query.status = status;
        if (orderId) query.orderId = String(orderId).trim();

        const skip = (page - 1) * limit;

        const [data, totalCount] = await Promise.all([
            NotificationLog.find(query)
                .sort({ sentAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            NotificationLog.countDocuments(query),
        ]);

        return res.json({
            message: 'Notifications fetched successfully',
            error: false,
            success: true,
            data,
            totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
        });
    } catch (err) {
        logger.error({ err }, 'Failed to list notifications');
        return res.status(500).json({
            message: err.message || 'Internal server error',
            error: true,
            success: false,
        });
    }
};
