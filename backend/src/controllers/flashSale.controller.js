// ---------------------------------------------------------------
// Flash Sale controller.
//
// Admin CRUD for time-limited promotions.  Each flash sale carries a list of
// product variants that sell at a reduced price during the sale window.
//
// The storefront checkout honours flash prices atomically (see the lib helper
// used in clientOrder.route.js) so two concurrent buyers can't both purchase
// the last flash-priced unit.
// ---------------------------------------------------------------
import mongoose from 'mongoose';
import FlashSaleModel from '../models/flashSale.model.js';
import ProductModel from '../models/product.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created, noContent } from '../lib/ApiResponse.js';

// ---------------------------------------------------------------
// GET /api/admin/flash-sale
// ---------------------------------------------------------------
export const listFlashSales = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.active === 'true') filter.active = true;
    if (req.query.active === 'false') filter.active = false;

    const now = new Date();
    if (req.query.status === 'upcoming') {
        filter.startsAt = { $gt: now };
    } else if (req.query.status === 'active') {
        filter.startsAt = { $lte: now };
        filter.endsAt = { $gte: now };
        filter.active = true;
    } else if (req.query.status === 'ended') {
        filter.endsAt = { $lt: now };
    }

    const [sales, total] = await Promise.all([
        FlashSaleModel.find(filter).sort({ startsAt: -1 }).skip(skip).limit(limit).lean(),
        FlashSaleModel.countDocuments(filter),
    ]);

    return ok(res, {
        sales,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    }, 'Flash sales loaded');
});

// ---------------------------------------------------------------
// GET /api/admin/flash-sale/:id
// ---------------------------------------------------------------
export const getFlashSale = asyncHandler(async (req, res) => {
    const sale = await FlashSaleModel.findById(req.params.id).lean();
    if (!sale) throw ApiError.notFound('Flash sale not found');
    return ok(res, sale, 'Flash sale loaded');
});

// ---------------------------------------------------------------
// POST /api/admin/flash-sale  (product:write)
// Body: { title, description, startsAt, endsAt, active, items: [{ productId, weightIndex, salePrice, maxQty }] }
// ---------------------------------------------------------------
export const createFlashSale = asyncHandler(async (req, res) => {
    const { title, description = '', startsAt, endsAt, active = true, items = [] } = req.body;

    if (!title?.trim()) throw ApiError.badRequest('Title is required');
    if (!startsAt || !endsAt) throw ApiError.badRequest('Start and end dates are required');
    if (new Date(endsAt) <= new Date(startsAt)) {
        throw ApiError.badRequest('End date must be after start date');
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw ApiError.badRequest('At least one item is required');
    }

    // Enrich items with product name / weight label snapshots so the admin list
    // is useful even after the product is renamed.
    const enrichedItems = await enrichItems(items);

    const sale = await FlashSaleModel.create({
        title: title.trim(),
        description: description.trim(),
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        active,
        items: enrichedItems,
    });

    req.audit?.({
        action: 'flashSale.create',
        resource: 'FlashSale',
        resourceId: sale._id,
        message: `Created flash sale "${sale.title}"`,
    });

    return created(res, sale, 'Flash sale created');
});

// ---------------------------------------------------------------
// PUT /api/admin/flash-sale/:id  (product:write)
// ---------------------------------------------------------------
export const updateFlashSale = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const sale = await FlashSaleModel.findById(id);
    if (!sale) throw ApiError.notFound('Flash sale not found');

    const { title, description, startsAt, endsAt, active, items } = req.body;

    if (title !== undefined) sale.title = title.trim();
    if (description !== undefined) sale.description = description.trim();
    if (active !== undefined) sale.active = !!active;
    if (startsAt !== undefined) sale.startsAt = new Date(startsAt);
    if (endsAt !== undefined) sale.endsAt = new Date(endsAt);

    if (sale.endsAt <= sale.startsAt) {
        throw ApiError.badRequest('End date must be after start date');
    }

    if (Array.isArray(items)) {
        sale.items = await enrichItems(items);
    }

    await sale.save();

    req.audit?.({
        action: 'flashSale.update',
        resource: 'FlashSale',
        resourceId: sale._id,
        message: `Updated flash sale "${sale.title}"`,
    });

    return ok(res, sale, 'Flash sale updated');
});

// ---------------------------------------------------------------
// DELETE /api/admin/flash-sale/:id  (product:write)
// ---------------------------------------------------------------
export const deleteFlashSale = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const sale = await FlashSaleModel.findByIdAndDelete(id);
    if (!sale) throw ApiError.notFound('Flash sale not found');

    req.audit?.({
        action: 'flashSale.delete',
        resource: 'FlashSale',
        resourceId: id,
        message: `Deleted flash sale "${sale.title}"`,
    });

    return noContent(res);
});

// ---------------------------------------------------------------
// GET /api/client/flash-sale/active
// Returns all currently active flash sales with their items.
// Used by the storefront to show sale badges and countdown timers.
// ---------------------------------------------------------------
export const getActiveFlashSales = asyncHandler(async (req, res) => {
    const now = new Date();
    const sales = await FlashSaleModel.find({
        active: true,
        startsAt: { $lte: now },
        endsAt: { $gte: now },
    })
        .sort({ endsAt: 1 })
        .lean();

    return ok(res, sales, 'Active flash sales');
});

// ---------------------------------------------------------------
// Internal helper: look up product names / weight labels for
// a list of { productId, weightIndex, salePrice, maxQty } items.
// Returns enriched items ready for insertion into the DB.
// ---------------------------------------------------------------
async function enrichItems(rawItems) {
    // Gather unique product IDs to batch-load.
    const productIds = [...new Set(
        rawItems
            .map((i) => i.productId)
            .filter((id) => id && mongoose.isValidObjectId(id))
    )];

    const products = await ProductModel.find({ _id: { $in: productIds } })
        .select('firstName weights')
        .lean();

    const productMap = new Map(products.map((p) => [String(p._id), p]));

    return rawItems.map((item) => {
        const product = productMap.get(String(item.productId));
        const weightIndex = Number(item.weightIndex) || 0;
        const weightLabel = product?.weights?.[weightIndex]?.weight || '';
        const salePrice = Number(item.salePrice);
        if (!salePrice || salePrice < 0) {
            throw ApiError.badRequest(`Invalid sale price for product ${item.productId}`);
        }
        return {
            productId: item.productId,
            productName: product ? `${product.firstName}` : '',
            weightIndex,
            weightLabel,
            salePrice,
            maxQty: item.maxQty != null ? Number(item.maxQty) || null : null,
            soldQty: item.soldQty || 0, // preserve existing counter on update
        };
    });
}
