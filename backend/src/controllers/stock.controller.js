import StockMovementModel from '../models/stockMovement.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import { ApiError } from '../lib/ApiError.js';
import { isFeatureEnabled } from '../lib/siteSettings.js';

const REASONS = ['sale', 'return', 'cancel', 'adjustment'];
const CHANNELS = ['pos', 'ecommerce', 'chatbot', 'admin', 'system'];

// GET /api/admin/stock/ledger
//   ?page=&limit=&productId=&reason=&channel=&from=&to=&search=
// Paginated, filterable view of the immutable stock ledger. Gated by the
// admin-toggleable `stockLedger` feature flag.
export const getStockLedger = asyncHandler(async (req, res) => {
    const enabled = await isFeatureEnabled('stockLedger', true);
    if (!enabled) throw ApiError.forbidden('Stock ledger is disabled in site settings');

    let { page = 1, limit = 30, productId, reason, channel, from, to, search } = req.query;
    page = parseInt(page, 10) || 1;
    limit = Math.min(parseInt(limit, 10) || 30, 100);

    const query = {};
    if (productId) query.productId = String(productId);
    if (reason && REASONS.includes(reason)) query.reason = reason;
    if (channel && CHANNELS.includes(channel)) query.channel = channel;
    if (search) {
        query.$or = [
            { productName: { $regex: search, $options: 'i' } },
            { orderId: { $regex: search, $options: 'i' } },
        ];
    }
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [data, totalCount] = await Promise.all([
        StockMovementModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        StockMovementModel.countDocuments(query),
    ]);

    return ok(res, {
        data,
        page,
        totalCount,
        totalNoPage: Math.ceil(totalCount / limit),
    }, 'Stock ledger fetched');
});
