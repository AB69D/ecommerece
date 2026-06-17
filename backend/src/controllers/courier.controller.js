import OrderModel from '../models/order.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { getSettings, invalidateSettingsCache } from '../lib/siteSettings.js';
import {
    pathaoCreateOrder,
    pathaoTrackOrder,
    steadfastCreateOrder,
    steadfastTrackOrder,
    steadfastGetBalance,
} from '../lib/courier.js';
import { ok } from '../lib/ApiResponse.js';
import { ApiError } from '../lib/ApiError.js';
import { logger } from '../lib/logger.js';
import mongoose from 'mongoose';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Persist updated Pathao tokens back into SiteSettings so the next request
 * picks them up without re-authenticating.
 */
const makeSavePathaoToken = (tenantId) => async (tokenPatch) => {
    try {
        await SiteSettings.updateOne(
            { tenantId, key: 'global' },
            {
                $set: {
                    'couriers.pathao.accessToken': tokenPatch.accessToken,
                    'couriers.pathao.refreshToken': tokenPatch.refreshToken,
                    'couriers.pathao.tokenExpiresAt': tokenPatch.tokenExpiresAt,
                },
            },
        );
        invalidateSettingsCache();
    } catch (err) {
        logger.error({ err }, 'Failed to persist Pathao token');
    }
};

// ── dispatch ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/courier/dispatch/:orderId
 * Body: { courier: 'pathao' | 'steadfast' }
 * requirePermission('order:write')
 */
export const dispatchOrderController = async (req, res) => {
    const { orderId } = req.params;
    const { courier } = req.body;

    if (!courier || !['pathao', 'steadfast'].includes(courier)) {
        throw ApiError.badRequest("courier must be 'pathao' or 'steadfast'");
    }

    const order = await OrderModel.findOne({ orderId }).lean();
    if (!order) throw ApiError.notFound('Order not found');

    if (order.courierProvider) {
        throw ApiError.conflict(
            `Order already dispatched via ${order.courierProvider} (${order.courierTrackingCode || order.courierConsignmentId})`,
        );
    }

    const settings = await getSettings();
    const creds = settings?.couriers?.[courier];
    if (!creds?.enabled) {
        throw ApiError.badRequest(
            `${courier === 'pathao' ? 'Pathao' : 'Steadfast'} is not configured or not enabled. Go to Settings → Couriers.`,
        );
    }

    let result;

    if (courier === 'pathao') {
        if (!creds.clientId || !creds.clientSecret || !creds.username || !creds.password) {
            throw ApiError.badRequest('Pathao credentials are incomplete. Check Settings → Couriers.');
        }
        if (!creds.storeId) {
            throw ApiError.badRequest('Pathao Store ID is required. Check Settings → Couriers.');
        }

        const tokenState = {
            accessToken: creds.accessToken || '',
            refreshToken: creds.refreshToken || '',
            tokenExpiresAt: creds.tokenExpiresAt || null,
        };

        result = await pathaoCreateOrder(
            creds,
            tokenState,
            makeSavePathaoToken(req.tenantId),
            order,
        );
    } else {
        // steadfast
        if (!creds.apiKey || !creds.secretKey) {
            throw ApiError.badRequest('Steadfast API key / secret key missing. Check Settings → Couriers.');
        }
        result = await steadfastCreateOrder(creds, order);
    }

    if (!result.ok) {
        logger.error({ courier, orderId, error: result.error }, 'Courier dispatch failed');
        throw ApiError.badRequest(`Courier error: ${result.error}`);
    }

    // Persist courier info on the order
    const updated = await OrderModel.findOneAndUpdate(
        { orderId },
        {
            $set: {
                courierProvider: courier,
                courierConsignmentId: result.consignmentId || '',
                courierTrackingCode: result.trackingCode || '',
                courierStatus: result.rawStatus || 'pending',
                courierDispatchedAt: new Date(),
                courierLastCheckedAt: new Date(),
                orderStatus: 'processing',
            },
        },
        { new: true },
    ).lean();

    return ok(res, updated, `Order dispatched via ${courier === 'pathao' ? 'Pathao' : 'Steadfast'}`);
};

// ── track ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/courier/track/:orderId
 * requirePermission('order:read')
 */
export const trackOrderController = async (req, res) => {
    const { orderId } = req.params;

    const order = await OrderModel.findOne({ orderId }).lean();
    if (!order) throw ApiError.notFound('Order not found');

    if (!order.courierProvider) {
        throw ApiError.badRequest('This order has not been dispatched via a courier yet.');
    }

    const settings = await getSettings();
    const creds = settings?.couriers?.[order.courierProvider];
    if (!creds?.enabled) {
        throw ApiError.badRequest('Courier credentials are not configured.');
    }

    let result;

    if (order.courierProvider === 'pathao') {
        const tokenState = {
            accessToken: creds.accessToken || '',
            refreshToken: creds.refreshToken || '',
            tokenExpiresAt: creds.tokenExpiresAt || null,
        };
        result = await pathaoTrackOrder(
            creds,
            tokenState,
            makeSavePathaoToken(req.tenantId),
            order.courierConsignmentId || order.courierTrackingCode,
        );
    } else {
        result = await steadfastTrackOrder(creds, order.courierTrackingCode);
    }

    if (!result.ok) {
        throw ApiError.badRequest(`Tracking error: ${result.error}`);
    }

    // Update cached status on the order
    await OrderModel.updateOne(
        { orderId },
        {
            $set: {
                courierStatus: result.rawStatus || '',
                courierLastCheckedAt: new Date(),
            },
        },
    );

    return ok(res, {
        orderId,
        courier: order.courierProvider,
        consignmentId: order.courierConsignmentId,
        trackingCode: order.courierTrackingCode,
        status: result.status,
        rawStatus: result.rawStatus,
        dispatchedAt: order.courierDispatchedAt,
        lastCheckedAt: new Date(),
    });
};

// ── Steadfast balance ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/courier/steadfast-balance
 * requirePermission('analytics:read')
 */
export const steadfastBalanceController = async (req, res) => {
    const settings = await getSettings();
    const creds = settings?.couriers?.steadfast;
    if (!creds?.enabled || !creds?.apiKey) {
        throw ApiError.badRequest('Steadfast is not configured. Go to Settings → Couriers.');
    }

    const result = await steadfastGetBalance(creds);
    if (!result.ok) {
        throw ApiError.badRequest(`Steadfast balance error: ${result.error}`);
    }

    return ok(res, result);
};

// ── COD summary ───────────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/courier/cod-summary
 * Aggregate pending COD from own order records (shipped + delivered).
 * requirePermission('analytics:read')
 */
export const codSummaryController = async (req, res) => {
    const rows = await OrderModel.aggregate([
        // tenantId MUST be the first $match stage in aggregations (tenantPlugin does not apply)
        { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId) } },
        {
            $match: {
                orderStatus: { $in: ['shipped', 'delivered'] },
                paymentMethod: 'cash_on_delivery',
                courierProvider: { $in: ['pathao', 'steadfast'] },
                codRemitted: { $ne: true },
            },
        },
        {
            $group: {
                _id: '$courierProvider',
                totalCOD: { $sum: '$totalAmount' },
                orderCount: { $sum: 1 },
            },
        },
    ]);

    const summary = { pathao: { totalCOD: 0, orderCount: 0 }, steadfast: { totalCOD: 0, orderCount: 0 } };
    for (const row of rows) {
        if (row._id === 'pathao' || row._id === 'steadfast') {
            summary[row._id] = { totalCOD: row.totalCOD, orderCount: row.orderCount };
        }
    }

    return ok(res, summary);
};

// ── Remittance orders ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/admin/courier/remittance-orders
 * Returns per-order detail for unremitted COD orders, grouped by courier.
 * Used by the Remittance detail page.
 * requirePermission('order:read')
 */
export const remittanceOrdersController = async (req, res) => {
    const orders = await OrderModel.find({
        orderStatus: { $in: ['shipped', 'delivered'] },
        paymentMethod: 'cash_on_delivery',
        courierProvider: { $in: ['pathao', 'steadfast'] },
        codRemitted: { $ne: true },
    })
        .select('orderId customerName customerPhone totalAmount orderStatus courierProvider courierDispatchedAt courierTrackingCode courierConsignmentId createdAt')
        .sort({ createdAt: -1 })
        .lean();

    const grouped = { pathao: [], steadfast: [] };
    for (const order of orders) {
        if (order.courierProvider === 'pathao' || order.courierProvider === 'steadfast') {
            grouped[order.courierProvider].push(order);
        }
    }

    const result = {};
    for (const courier of ['pathao', 'steadfast']) {
        const list = grouped[courier];
        result[courier] = {
            totalCOD: list.reduce((s, o) => s + (o.totalAmount || 0), 0),
            orderCount: list.length,
            orders: list,
        };
    }

    return ok(res, result);
};

// ── mark remitted ─────────────────────────────────────────────────────────────

/**
 * POST /api/v1/admin/courier/mark-remitted
 * Body: { courier: 'pathao'|'steadfast', beforeDate?: ISO string }
 * Marks all matching delivered COD orders as remitted.
 * requirePermission('order:write')
 */
export const markRemittedController = async (req, res) => {
    const { courier, beforeDate } = req.body;

    if (!courier || !['pathao', 'steadfast'].includes(courier)) {
        throw ApiError.badRequest("courier must be 'pathao' or 'steadfast'");
    }

    const matchFilter = {
        tenantId: new mongoose.Types.ObjectId(req.tenantId),
        orderStatus: { $in: ['shipped', 'delivered'] },
        paymentMethod: 'cash_on_delivery',
        courierProvider: courier,
        codRemitted: { $ne: true },
    };

    if (beforeDate) {
        const cutoff = new Date(beforeDate);
        if (isNaN(cutoff.getTime())) throw ApiError.badRequest('Invalid beforeDate');
        matchFilter.deliveredAt = { $lte: cutoff };
    }

    const result = await OrderModel.updateMany(matchFilter, {
        $set: { codRemitted: true, codRemittedAt: new Date() },
    });

    return ok(res, { modifiedCount: result.modifiedCount, courier });
};
