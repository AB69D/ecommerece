// ---------------------------------------------------------------
// POS (Point of Sale) controller.
//
// In-store terminal used by `pos-seller` accounts (and any admin with the
// `pos:sell` / `pos:read` permissions). POS sales are stored in the SAME
// Order collection as e-commerce orders (source: 'pos') and draw down the
// SAME product inventory, so stock stays in sync across both channels.
//
// A POS order is "instant": rung up, paid, and handed over at the counter,
// so it is created already delivered/paid with no delivery charge.
// ---------------------------------------------------------------
import OrderModel from '../models/order.model.js';
import ProductModel from '../models/product.model.js';
import CouponModel from '../models/coupon.model.js';
import ShiftModel from '../models/shift.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created } from '../lib/ApiResponse.js';
import { setHasPermission } from '../lib/permissions.js';
import { evaluateCoupon } from '../lib/coupon.js';
import { getSettings } from '../lib/siteSettings.js';

// Net unit price for a product weight after its own discount.
const retailUnitPrice = (w) => {
    const base = Number(w?.price) || 0;
    const disc = Number(w?.discountPercent) || 0;
    const net = base * (1 - disc / 100);
    return Math.round(net * 100) / 100;
};

const productDisplayName = (p) =>
    `${p.firstName}${p.lastName ? ` ${p.lastName}` : ''}`.trim();

const sellerSnapshot = (req) => {
    const a = req.adminDoc;
    if (!a) return { id: null, username: null, fullName: null };
    return {
        id: String(a._id),
        username: a.username,
        fullName: a.fullName || a.username,
    };
};

// pos:manage lets a seller see/return every POS order; otherwise they are
// scoped to their own sales only.
const canManageAll = (req) => setHasPermission(req.permissions || new Set(), 'pos:manage');

// ---------------------------------------------------------------
// GET /api/admin/pos/products?search=&categoryId=
// Catalog for the terminal: every product with its sellable weights, live
// stock, and the computed retail price. Out-of-stock variants are kept so
// the cashier can see "0 left".
// ---------------------------------------------------------------
export const getPosProducts = asyncHandler(async (req, res) => {
    const { search, categoryId } = req.query;

    const query = {};
    if (categoryId) query.category = categoryId;
    if (search) {
        query.$or = [
            { firstName: { $regex: search, $options: 'i' } },
            { lastName: { $regex: search, $options: 'i' } },
        ];
    }

    const products = await ProductModel.find(query)
        .populate('category', 'category_name')
        .sort({ createdAt: -1 })
        .lean();

    const data = products.map((p) => ({
        _id: String(p._id),
        name: productDisplayName(p),
        coverImage: p.cover_image || '',
        category: p.category?.category_name || 'Uncategorized',
        categoryId: p.category?._id ? String(p.category._id) : null,
        variants: (p.weights || []).map((w, index) => ({
            weightIndex: index,
            weight: w.weight,
            stock: w.stock || 0,
            price: Number(w.price) || 0,
            discountPercent: Number(w.discountPercent) || 0,
            salePrice: retailUnitPrice(w),
            sku: w.sku || '',
            barcode: w.barcode || '',
            image: (Array.isArray(w.images) && w.images[0]) || p.cover_image || '',
        })),
    }));

    return ok(res, data, 'POS products fetched');
});

// ---------------------------------------------------------------
// GET /api/admin/pos/lookup?code=<barcode|sku>
// Scanner endpoint: resolve a scanned barcode or typed SKU to the exact
// product + variant so the cashier can drop it straight into the cart.
// Matches on the variant's barcode first, then its SKU (both indexed).
// ---------------------------------------------------------------
export const lookupByCode = asyncHandler(async (req, res) => {
    const code = String(req.query.code || '').trim();
    if (!code) throw ApiError.badRequest('A barcode or SKU is required');

    const product = await ProductModel.findOne({
        $or: [{ 'weights.barcode': code }, { 'weights.sku': code }],
    })
        .populate('category', 'category_name')
        .lean();

    if (!product) throw ApiError.notFound(`No product matches "${code}"`);

    // Find the exact variant that carries this code (barcode wins over sku).
    const weights = product.weights || [];
    let idx = weights.findIndex((w) => w.barcode && w.barcode === code);
    if (idx < 0) idx = weights.findIndex((w) => w.sku && w.sku === code);
    if (idx < 0) idx = 0; // matched the product but not a specific variant
    const w = weights[idx] || {};

    return ok(
        res,
        {
            productId: String(product._id),
            name: productDisplayName(product),
            coverImage: product.cover_image || '',
            category: product.category?.category_name || 'Uncategorized',
            categoryId: product.category?._id ? String(product.category._id) : null,
            variant: {
                weightIndex: idx,
                weight: w.weight,
                stock: w.stock || 0,
                price: Number(w.price) || 0,
                discountPercent: Number(w.discountPercent) || 0,
                salePrice: retailUnitPrice(w),
                sku: w.sku || '',
                barcode: w.barcode || '',
                image: (Array.isArray(w.images) && w.images[0]) || product.cover_image || '',
            },
        },
        'Product found',
    );
});

// ---------------------------------------------------------------
// POST /api/admin/pos/sale
// Body: { items:[{productId, weightIndex, quantity, unitPrice?}],
//         saleType:'retail'|'wholesale', customerName?, customerPhone?,
//         paymentMethod?, notes? }
// Retail uses the DB price; wholesale honours the cashier's per-line
// unitPrice override. Stock is decremented atomically with a $gte guard
// and rolled back if any line cannot be satisfied.
// ---------------------------------------------------------------
export const createPosSale = asyncHandler(async (req, res) => {
    const {
        items,
        saleType = 'retail',
        customerName,
        customerPhone,
        customerEmail,
        paymentMethod = 'cash',
        notes = '',
        couponCode = '',
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        throw ApiError.badRequest('Cart is empty');
    }
    const isWholesale = saleType === 'wholesale';

    // Resolve the POS shift to attribute this sale to (when the feature is
    // enabled). Done before touching stock so a `requireShift` rejection
    // leaves inventory untouched.
    let shiftId = null;
    const settings = await getSettings();
    const shiftEnabled = settings?.features?.posShift !== false;
    if (shiftEnabled) {
        const openShift = await ShiftModel.findOne({
            'cashier.id': String(req.adminDoc?._id),
            status: 'open',
        }).select('_id').lean();
        if (openShift) {
            shiftId = String(openShift._id);
        } else if (settings?.pos?.requireShift) {
            throw ApiError.badRequest('Please open a POS shift before making a sale.');
        }
    }

    // Load every referenced product once.
    const ids = [...new Set(items.map((i) => i.productId))];
    const products = await ProductModel.find({ _id: { $in: ids } }).lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    // Build order lines + validate stock from the freshly-read docs.
    const orderItems = [];
    for (const item of items) {
        const product = byId.get(String(item.productId));
        if (!product) throw ApiError.notFound(`Product not found: ${item.productId}`);

        const idx = Number(item.weightIndex) || 0;
        const w = product.weights?.[idx];
        if (!w) throw ApiError.badRequest(`Invalid variant for ${productDisplayName(product)}`);

        const quantity = Math.max(1, parseInt(item.quantity, 10) || 0);
        if ((w.stock || 0) < quantity) {
            throw ApiError.conflict(
                `Not enough stock for ${productDisplayName(product)} (${w.weight}). Only ${w.stock || 0} left.`,
            );
        }

        // Wholesale: trust the authenticated cashier's price override (>= 0).
        // Retail: always the server-computed price (ignore any client value).
        let unitPrice = retailUnitPrice(w);
        if (isWholesale && item.unitPrice !== undefined && item.unitPrice !== null) {
            const override = Number(item.unitPrice);
            if (!Number.isFinite(override) || override < 0) {
                throw ApiError.badRequest('Invalid wholesale price');
            }
            unitPrice = Math.round(override * 100) / 100;
        }

        orderItems.push({
            productId: String(product._id),
            productName: productDisplayName(product),
            productImage: (Array.isArray(w.images) && w.images[0]) || product.cover_image || '',
            quantity,
            weight: w.weight,
            weightIndex: idx,
            price: unitPrice,
            totalPrice: Math.round(unitPrice * quantity * 100) / 100,
            costPrice: Math.round((Number(w.costPrice) || 0) * 100) / 100,
        });
    }

    // Atomically draw down stock; track applied decrements for rollback.
    const applied = [];
    for (const line of orderItems) {
        const result = await ProductModel.updateOne(
            { _id: line.productId, [`weights.${line.weightIndex}.stock`]: { $gte: line.quantity } },
            { $inc: { [`weights.${line.weightIndex}.stock`]: -line.quantity } },
        );
        if (result.modifiedCount !== 1) {
            // Lost a race — undo everything already decremented.
            for (const done of applied) {
                await ProductModel.updateOne(
                    { _id: done.productId },
                    { $inc: { [`weights.${done.weightIndex}.stock`]: done.quantity } },
                );
            }
            throw ApiError.conflict(`Stock changed for ${line.productName}. Please re-scan and try again.`);
        }
        applied.push(line);
    }

    const subtotal = Math.round(orderItems.reduce((s, i) => s + i.totalPrice, 0) * 100) / 100;

    // Re-validate any coupon server-side; an invalid code is ignored (the sale
    // still completes) rather than rejected at the till.
    let discount = 0;
    let appliedCoupon = '';
    let couponDoc = null;
    const wantCoupon = String(couponCode || '').trim().toUpperCase();
    if (wantCoupon) {
        couponDoc = await CouponModel.findOne({ code: wantCoupon });
        const result = evaluateCoupon(couponDoc, { subtotal, channel: 'pos' });
        if (result.ok && result.discount > 0) {
            discount = result.discount;
            appliedCoupon = couponDoc.code;
        } else {
            couponDoc = null;
        }
    }
    const totalAmount = Math.max(0, Math.round((subtotal - discount) * 100) / 100);

    const seller = sellerSnapshot(req);

    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    const orderId = `POS-${timestamp}${random}`;

    const now = new Date();
    const order = await OrderModel.create({
        orderId,
        source: 'pos',
        saleType: isWholesale ? 'wholesale' : 'retail',
        soldBy: seller,
        shiftId,
        guestId: `pos_${seller.id || 'staff'}_${Date.now()}`,
        customerName: customerName?.trim() || 'Walk-in Customer',
        customerPhone: customerPhone?.trim() || 'N/A',
        customerEmail: customerEmail?.trim() || '',
        shippingAddress: 'In-store (POS)',
        city: 'pos',
        items: orderItems,
        subtotal,
        deliveryCharge: 0,
        couponCode: appliedCoupon,
        discount,
        totalAmount,
        paymentMethod: ['cash', 'card', 'online'].includes(paymentMethod) ? paymentMethod : 'cash',
        paymentStatus: 'paid',
        orderStatus: 'delivered',
        deliveredAt: now,
        confirmedAt: now,
        notes,
    });

    // Count the redemption (best-effort, non-fatal).
    if (couponDoc) {
        try {
            await CouponModel.updateOne({ _id: couponDoc._id }, { $inc: { usedCount: 1 } });
        } catch {
            // ignore
        }
    }

    return created(res, order, 'Sale completed');
});

// ---------------------------------------------------------------
// POST /api/admin/pos/return   { orderId }
// Full-order return: restock every line and mark the order 'returned'.
// Sellers can only return their own sales unless they have pos:manage.
// ---------------------------------------------------------------
export const returnPosSale = asyncHandler(async (req, res) => {
    const { orderId } = req.body;
    if (!orderId) throw ApiError.badRequest('orderId is required');

    const order = await OrderModel.findOne({ orderId, source: 'pos' });
    if (!order) throw ApiError.notFound('POS order not found');

    if (!canManageAll(req) && String(order.soldBy?.id) !== String(req.adminDoc?._id)) {
        throw ApiError.forbidden('You can only return your own sales');
    }
    if (order.orderStatus === 'returned') {
        throw ApiError.conflict('This sale has already been returned');
    }

    // Put the stock back.
    for (const item of order.items) {
        if (item.weightIndex !== undefined && item.weightIndex !== null) {
            await ProductModel.updateOne(
                { _id: item.productId },
                { $inc: { [`weights.${item.weightIndex}.stock`]: item.quantity } },
            );
        }
    }

    order.orderStatus = 'returned';
    order.paymentStatus = 'refunded';
    order.cancelledAt = new Date();
    order.adminNotes = `${order.adminNotes ? `${order.adminNotes}\n` : ''}Returned at POS by ${req.adminDoc?.username || 'staff'}`;
    await order.save();

    return ok(res, order, 'Sale returned and stock restored');
});

// ---------------------------------------------------------------
// GET /api/admin/pos/sales?page=&limit=&search=&saleType=&from=&to=
// Sales history. Scoped to the current seller unless they have pos:manage.
// ---------------------------------------------------------------
export const getPosSales = asyncHandler(async (req, res) => {
    let { page = 1, limit = 20, search, saleType, from, to } = req.query;
    page = parseInt(page, 10) || 1;
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const query = { source: 'pos' };
    if (!canManageAll(req)) query['soldBy.id'] = String(req.adminDoc?._id);
    if (saleType && ['retail', 'wholesale'].includes(saleType)) query.saleType = saleType;
    if (search) {
        query.$or = [
            { orderId: { $regex: search, $options: 'i' } },
            { customerName: { $regex: search, $options: 'i' } },
            { customerPhone: { $regex: search, $options: 'i' } },
        ];
    }
    if (from || to) {
        query.createdAt = {};
        if (from) query.createdAt.$gte = new Date(from);
        if (to) query.createdAt.$lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [data, totalCount] = await Promise.all([
        OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        OrderModel.countDocuments(query),
    ]);

    return res.json({
        success: true,
        message: 'POS sales fetched',
        data,
        totalCount,
        totalNoPage: Math.ceil(totalCount / limit),
    });
});

// ---------------------------------------------------------------
// GET /api/admin/pos/report
// Headline numbers for the seller's reporting tab: today / week / all-time
// counts + revenue, a retail-vs-wholesale split, and recent sales.
// Scoped to the seller unless they have pos:manage.
// ---------------------------------------------------------------
export const getPosReport = asyncHandler(async (req, res) => {
    const scope = { source: 'pos', orderStatus: { $ne: 'returned' } };
    if (!canManageAll(req)) scope['soldBy.id'] = String(req.adminDoc?._id);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6); // last 7 days inclusive

    const sumStage = (match) => [
        { $match: match },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
    ];

    const [todayAgg, weekAgg, allAgg, typeAgg, returnsAgg, recent] = await Promise.all([
        OrderModel.aggregate(sumStage({ ...scope, createdAt: { $gte: startOfToday } })),
        OrderModel.aggregate(sumStage({ ...scope, createdAt: { $gte: startOfWeek } })),
        OrderModel.aggregate(sumStage(scope)),
        OrderModel.aggregate([
            { $match: scope },
            { $group: { _id: '$saleType', count: { $sum: 1 }, revenue: { $sum: '$totalAmount' } } },
        ]),
        OrderModel.countDocuments({
            source: 'pos',
            orderStatus: 'returned',
            ...(canManageAll(req) ? {} : { 'soldBy.id': String(req.adminDoc?._id) }),
        }),
        OrderModel.find(scope).sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const pick = (agg) => ({
        count: agg[0]?.count || 0,
        revenue: Math.round((agg[0]?.revenue || 0) * 100) / 100,
    });

    const byType = { retail: { count: 0, revenue: 0 }, wholesale: { count: 0, revenue: 0 } };
    for (const row of typeAgg) {
        const key = row._id === 'wholesale' ? 'wholesale' : 'retail';
        byType[key] = { count: row.count, revenue: Math.round(row.revenue * 100) / 100 };
    }

    return ok(
        res,
        {
            today: pick(todayAgg),
            week: pick(weekAgg),
            allTime: pick(allAgg),
            returns: returnsAgg,
            byType,
            recent,
            scope: canManageAll(req) ? 'all' : 'self',
        },
        'POS report fetched',
    );
});
