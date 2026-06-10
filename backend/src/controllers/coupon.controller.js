// ---------------------------------------------------------------
// Coupon controller.
//
// Admin CRUD for cart-level discount codes plus a shared "validate" endpoint
// that previews a code's discount for a given subtotal/channel. The actual
// redemption (and usedCount increment) happens server-side inside the order /
// POS sale flows — never trusting a client-supplied discount amount.
// ---------------------------------------------------------------
import CouponModel from '../models/coupon.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created, noContent } from '../lib/ApiResponse.js';
import { evaluateCoupon } from '../lib/coupon.js';

const normalizeCode = (code) => String(code || '').trim().toUpperCase();

// Public shape returned to the storefront/POS (no internal usage counters
// beyond what's needed to render the applied discount).
const publicCoupon = (c, discount) => ({
    code: c.code,
    description: c.description || '',
    type: c.type,
    value: c.value,
    discount,
});

// ---------------------------------------------------------------
// GET /api/admin/coupon  (discount:read)
// ---------------------------------------------------------------
export const listCoupons = asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.search) {
        const rx = { $regex: req.query.search, $options: 'i' };
        query.$or = [{ code: rx }, { description: rx }];
    }
    if (req.query.active === 'true') query.active = true;
    if (req.query.active === 'false') query.active = false;

    const [coupons, total] = await Promise.all([
        CouponModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        CouponModel.countDocuments(query),
    ]);

    return ok(res, {
        coupons,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    }, 'Coupons loaded');
});

// ---------------------------------------------------------------
// POST /api/admin/coupon  (discount:write)
// ---------------------------------------------------------------
export const createCoupon = asyncHandler(async (req, res) => {
    const code = normalizeCode(req.body.code);
    const exists = await CouponModel.findOne({ code }).lean();
    if (exists) throw ApiError.conflict(`Coupon "${code}" already exists`);

    const coupon = await CouponModel.create({ ...req.body, code });
    req.audit?.({
        action: 'coupon.create',
        resource: 'Coupon',
        resourceId: coupon._id,
        message: `Created coupon "${coupon.code}"`,
        after: { code: coupon.code, type: coupon.type, value: coupon.value },
    });
    return created(res, coupon, 'Coupon created');
});

// ---------------------------------------------------------------
// PUT /api/admin/coupon/:id  (discount:write)
// ---------------------------------------------------------------
export const updateCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const coupon = await CouponModel.findById(id);
    if (!coupon) throw ApiError.notFound('Coupon not found');

    if (req.body.code) {
        const code = normalizeCode(req.body.code);
        if (code !== coupon.code) {
            const clash = await CouponModel.findOne({ code, _id: { $ne: id } }).lean();
            if (clash) throw ApiError.conflict(`Coupon "${code}" already exists`);
        }
        req.body.code = code;
    }

    Object.assign(coupon, req.body);
    await coupon.save();
    req.audit?.({
        action: 'coupon.update',
        resource: 'Coupon',
        resourceId: coupon._id,
        message: `Updated coupon "${coupon.code}"`,
    });
    return ok(res, coupon, 'Coupon updated');
});

// ---------------------------------------------------------------
// DELETE /api/admin/coupon/:id  (discount:delete)
// ---------------------------------------------------------------
export const deleteCoupon = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const coupon = await CouponModel.findByIdAndDelete(id);
    if (!coupon) throw ApiError.notFound('Coupon not found');
    req.audit?.({
        action: 'coupon.delete',
        resource: 'Coupon',
        resourceId: id,
        message: `Deleted coupon "${coupon.code}"`,
    });
    return noContent(res);
});

// ---------------------------------------------------------------
// POST /api/admin/coupon/validate  and  POST /api/client/coupon/validate
// Body: { code, subtotal, channel } -> { valid, reason, coupon }
// Shared preview used by both storefront checkout and the POS terminal.
// ---------------------------------------------------------------
export const validateCoupon = asyncHandler(async (req, res) => {
    const code = normalizeCode(req.body.code);
    const subtotal = Number(req.body.subtotal) || 0;
    const channel = req.body.channel === 'pos' ? 'pos' : 'ecommerce';

    const coupon = await CouponModel.findOne({ code }).lean();
    const result = evaluateCoupon(coupon, { subtotal, channel });

    if (!result.ok) {
        // 200 with valid:false keeps the storefront flow simple (no try/catch
        // on an expected "bad code" path).
        return ok(res, { valid: false, reason: result.reason, coupon: null }, result.reason);
    }
    return ok(res, {
        valid: true,
        reason: '',
        coupon: publicCoupon(coupon, result.discount),
    }, 'Coupon applied');
});
