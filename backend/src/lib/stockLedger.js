import StockMovementModel from '../models/stockMovement.model.js';
import { isFeatureEnabled } from './siteSettings.js';
import { logger } from './logger.js';

// Record one or more inventory movements into the stock ledger.
//
// Best-effort + feature-gated: this NEVER throws, so a ledger write can't break
// a sale, return or stock edit. When the `stockLedger` feature flag is off it
// is a no-op (no documents are written).
//
//   entries: [{ productId, productName?, weightIndex?, weight?, delta, balanceAfter? }]
//   common:  { reason, channel?, orderId?, actor?, note? }   (applied to all)
export const recordStockMovements = async (entries, common = {}) => {
    try {
        if (!Array.isArray(entries) || entries.length === 0) return;
        const enabled = await isFeatureEnabled('stockLedger', true);
        if (!enabled) return;

        const docs = entries
            .filter((e) => e && e.productId != null && Number(e.delta) !== 0)
            .map((e) => ({
                productId: String(e.productId),
                productName: e.productName || '',
                weightIndex: Number(e.weightIndex) || 0,
                weight: e.weight || '',
                delta: Number(e.delta),
                balanceAfter: e.balanceAfter === undefined ? null : e.balanceAfter,
                reason: common.reason,
                channel: common.channel || 'system',
                orderId: common.orderId || '',
                actor: common.actor || { id: null, username: null, fullName: null },
                note: common.note || '',
            }));

        if (docs.length === 0) return;
        await StockMovementModel.insertMany(docs, { ordered: false });
    } catch (err) {
        logger.error({ err }, 'Failed to record stock movements');
    }
};

// Build an actor snapshot from req.adminDoc (admin / POS cashier). Returns all
// nulls for unauthenticated, customer-driven flows.
export const actorFromReq = (req) => {
    const a = req?.adminDoc;
    if (!a) return { id: null, username: null, fullName: null };
    return { id: String(a._id), username: a.username, fullName: a.fullName || a.username };
};
