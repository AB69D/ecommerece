import mongoose from 'mongoose';
import StockMovementModel from '../models/stockMovement.model.js';
import ProductModel from '../models/product.model.js';
import { isFeatureEnabled } from './siteSettings.js';
import { logger } from './logger.js';

// Apply a batch of UNCONDITIONAL stock adjustments in a single round trip
// (one bulkWrite instead of N sequential updateOne calls).
//
// Use this ONLY for adjustments that cannot lose a race: restocks on cancel /
// return, and trusted admin decrements where oversell isn't a concern. It does
// a plain $inc per line with NO `$gte` guard, so it must NOT replace the
// storefront / POS checkout draw-down — those keep their guarded, sequential
// decrement so two shoppers can't both buy the last unit.
//
//   entries: [{ productId, weightIndex, delta }]
//            delta is signed: -n draws stock down, +n puts it back.
export const applyStockDeltas = async (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const ops = entries
        .filter((e) => e && e.productId != null && e.weightIndex != null && Number(e.delta) !== 0)
        .map((e) => ({
            updateOne: {
                filter: { _id: e.productId },
                update: { $inc: { [`weights.${Number(e.weightIndex)}.stock`]: Number(e.delta) } },
            },
        }));
    if (ops.length === 0) return;
    await ProductModel.bulkWrite(ops, { ordered: false });
};

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

// Return total stock figures for a single product variant across all locations.
//
// When multiWarehouse is enabled the authoritative stock lives in LocationStock
// documents, so we SUM across them. Otherwise we fall back to the flat
// product.weights[weightIndex].stock field.
//
//   returns: { stock, reserved, available }
export const getTotalStockForVariant = async (tenantId, productId, weightIndex) => {
    try {
        const mwEnabled = await isFeatureEnabled('multiWarehouse', false);

        if (mwEnabled) {
            // Lazy import to avoid circular-dependency risk at module load time
            const { LocationStockModel } = await import('../models/LocationStock.model.js');
            const result = await LocationStockModel.aggregate([
                {
                    $match: {
                        tenantId: new mongoose.Types.ObjectId(tenantId),
                        productId: new mongoose.Types.ObjectId(productId),
                        weightIndex: Number(weightIndex),
                    },
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$stock' },
                        reserved: { $sum: '$reservedQty' },
                    },
                },
            ]);

            if (result[0]) {
                const { total, reserved } = result[0];
                return { stock: total, reserved, available: Math.max(0, total - reserved) };
            }
            return { stock: 0, reserved: 0, available: 0 };
        }

        // Fallback: read from flat product.weights[weightIndex].stock
        const product = await ProductModel.findOne(
            { _id: new mongoose.Types.ObjectId(productId), tenantId: new mongoose.Types.ObjectId(tenantId) },
        ).select('weights').lean();

        const stock = product?.weights?.[Number(weightIndex)]?.stock ?? 0;
        return { stock, reserved: 0, available: stock };
    } catch (err) {
        logger.error({ err }, 'getTotalStockForVariant failed');
        return { stock: 0, reserved: 0, available: 0 };
    }
};
