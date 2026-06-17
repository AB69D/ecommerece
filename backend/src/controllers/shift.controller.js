// ---------------------------------------------------------------
// POS shift / cash-drawer controller.
//
// Lets a cashier open a till session with a starting float, record
// mid-shift cash pay-ins/pay-outs, and close with a counted-cash
// reconciliation (the "Z-report"). Sales rung up during a shift are
// attributed to it via Order.shiftId so the close can total takings
// by payment method.
//
// Gated by the `posShift` feature flag (admin-toggleable); when the
// flag is off the routes report the feature as disabled. The
// `pos.requireShift` config (enforced in pos.controller) decides
// whether a sale demands an open shift.
// ---------------------------------------------------------------
import mongoose from 'mongoose';
import ShiftModel from '../models/shift.model.js';
import OrderModel from '../models/order.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../lib/ApiError.js';
import { ok, created } from '../lib/ApiResponse.js';
import { setHasPermission } from '../lib/permissions.js';
import { isFeatureEnabled } from '../lib/siteSettings.js';

// pos:manage lets a manager see/close every shift; otherwise scoped to own.
const canManageAll = (req) => setHasPermission(req.permissions || new Set(), 'pos:manage');

const cashierSnapshot = (req) => {
    const a = req.adminDoc;
    if (!a) return { id: null, username: null, fullName: null };
    return {
        id: String(a._id),
        username: a.username,
        fullName: a.fullName || a.username,
    };
};

// Throw if shifts are turned off in admin settings.
const ensureShiftEnabled = async () => {
    const enabled = await isFeatureEnabled('posShift', true);
    if (!enabled) {
        throw ApiError.forbidden('POS shifts are disabled in site settings');
    }
};

// Find the caller's currently-open shift, if any.
const findOpenShift = (req) =>
    ShiftModel.findOne({ 'cashier.id': String(req.adminDoc?._id), status: 'open' });

// Total POS takings attributed to a shift, split by payment method.
// Excludes returned orders so a refunded sale does not inflate the drawer.
const computeShiftSales = async (shiftId, tenantId) => {
    const rows = await OrderModel.aggregate([
        { $match: { tenantId: new mongoose.Types.ObjectId(tenantId), source: 'pos', shiftId: String(shiftId), orderStatus: { $ne: 'returned' } } },
        { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    const out = { cashSales: 0, cardSales: 0, otherSales: 0, totalSales: 0, orderCount: 0 };
    for (const r of rows) {
        const total = Math.round((r.total || 0) * 100) / 100;
        if (r._id === 'cash') out.cashSales += total;
        else if (r._id === 'card') out.cardSales += total;
        else out.otherSales += total;
        out.totalSales += total;
        out.orderCount += r.count || 0;
    }
    out.cashSales = Math.round(out.cashSales * 100) / 100;
    out.cardSales = Math.round(out.cardSales * 100) / 100;
    out.otherSales = Math.round(out.otherSales * 100) / 100;
    out.totalSales = Math.round(out.totalSales * 100) / 100;
    return out;
};

// Sum the recorded drawer movements (pay-ins vs pay-outs).
const sumMovements = (movements = []) => {
    let cashIn = 0;
    let cashOut = 0;
    for (const m of movements) {
        const amt = Number(m.amount) || 0;
        if (m.type === 'in') cashIn += amt;
        else if (m.type === 'out') cashOut += amt;
    }
    return {
        cashIn: Math.round(cashIn * 100) / 100,
        cashOut: Math.round(cashOut * 100) / 100,
    };
};

// Live drawer figures for an open shift (sales + movements + expected cash).
const summarizeShift = async (shift) => {
    const sales = await computeShiftSales(shift._id, shift.tenantId);
    const { cashIn, cashOut } = sumMovements(shift.movements);
    const expectedCash = Math.round((shift.openingFloat + sales.cashSales + cashIn - cashOut) * 100) / 100;
    return { ...sales, cashIn, cashOut, expectedCash };
};

// ---------------------------------------------------------------
// POST /api/admin/pos/shift/open   { openingFloat?, note? }
// Start a till session. Fails if the cashier already has one open.
// ---------------------------------------------------------------
export const openShift = asyncHandler(async (req, res) => {
    await ensureShiftEnabled();

    const existing = await findOpenShift(req);
    if (existing) {
        throw ApiError.conflict('You already have an open shift. Close it before opening a new one.');
    }

    const openingFloat = Math.max(0, Number(req.body.openingFloat) || 0);
    const note = String(req.body.note || '').trim();

    let shift;
    try {
        shift = await ShiftModel.create({
            cashier: cashierSnapshot(req),
            status: 'open',
            openingFloat,
            openedAt: new Date(),
            note,
        });
    } catch (err) {
        // Duplicate-key from the partial unique index = a concurrent open.
        if (err?.code === 11000) {
            throw ApiError.conflict('You already have an open shift.');
        }
        throw err;
    }

    req.audit?.({ action: 'pos.shift.open', resource: 'shift', resourceId: shift._id, meta: { openingFloat } });
    return created(res, shift, 'Shift opened');
});

// ---------------------------------------------------------------
// GET /api/admin/pos/shift/current
// The caller's open shift (with live drawer figures), or null.
// ---------------------------------------------------------------
export const getCurrentShift = asyncHandler(async (req, res) => {
    const enabled = await isFeatureEnabled('posShift', true);
    if (!enabled) return ok(res, { enabled: false, shift: null }, 'POS shifts are disabled');

    const shift = await findOpenShift(req);
    if (!shift) return ok(res, { enabled: true, shift: null }, 'No open shift');

    const summary = await summarizeShift(shift);
    return ok(res, { enabled: true, shift: shift.toObject(), summary }, 'Open shift');
});

// ---------------------------------------------------------------
// POST /api/admin/pos/shift/movement   { type:'in'|'out', amount, reason? }
// Record a mid-shift drawer pay-in or pay-out on the caller's open shift.
// ---------------------------------------------------------------
export const addMovement = asyncHandler(async (req, res) => {
    await ensureShiftEnabled();

    const shift = await findOpenShift(req);
    if (!shift) throw ApiError.badRequest('Open a shift before recording a cash movement');

    const type = req.body.type === 'out' ? 'out' : 'in';
    const amount = Math.round((Number(req.body.amount) || 0) * 100) / 100;
    if (!(amount > 0)) throw ApiError.badRequest('Movement amount must be greater than zero');
    const reason = String(req.body.reason || '').trim();

    shift.movements.push({
        type,
        amount,
        reason,
        at: new Date(),
        by: { id: String(req.adminDoc?._id), username: req.adminDoc?.username || null },
    });
    await shift.save();

    req.audit?.({ action: 'pos.shift.movement', resource: 'shift', resourceId: shift._id, meta: { type, amount } });

    const summary = await summarizeShift(shift);
    return ok(res, { shift: shift.toObject(), summary }, 'Cash movement recorded');
});

// ---------------------------------------------------------------
// POST /api/admin/pos/shift/close   { countedCash, note? }
// Reconcile and close the caller's open shift. Snapshots the Z-report
// (expected vs counted cash + the over/short difference).
// ---------------------------------------------------------------
export const closeShift = asyncHandler(async (req, res) => {
    await ensureShiftEnabled();

    const shift = await findOpenShift(req);
    if (!shift) throw ApiError.badRequest('You have no open shift to close');

    const countedCash = Math.max(0, Math.round((Number(req.body.countedCash) || 0) * 100) / 100);
    const note = String(req.body.note || '').trim();

    const summary = await summarizeShift(shift);
    const difference = Math.round((countedCash - summary.expectedCash) * 100) / 100;

    shift.status = 'closed';
    shift.closedAt = new Date();
    shift.closing = {
        countedCash,
        expectedCash: summary.expectedCash,
        difference,
        cashSales: summary.cashSales,
        cardSales: summary.cardSales,
        otherSales: summary.otherSales,
        totalSales: summary.totalSales,
        orderCount: summary.orderCount,
        cashIn: summary.cashIn,
        cashOut: summary.cashOut,
    };
    if (note) shift.note = shift.note ? `${shift.note}\n${note}` : note;
    await shift.save();

    req.audit?.({ action: 'pos.shift.close', resource: 'shift', resourceId: shift._id, meta: { difference } });
    return ok(res, shift, 'Shift closed');
});

// ---------------------------------------------------------------
// GET /api/admin/pos/shift?page=&limit=&status=
// Shift history. Scoped to the caller unless they have pos:manage.
// ---------------------------------------------------------------
export const listShifts = asyncHandler(async (req, res) => {
    let { page = 1, limit = 20, status } = req.query;
    page = parseInt(page, 10) || 1;
    limit = Math.min(parseInt(limit, 10) || 20, 100);

    const query = {};
    if (!canManageAll(req)) query['cashier.id'] = String(req.adminDoc?._id);
    if (status && ['open', 'closed'].includes(status)) query.status = status;

    const skip = (page - 1) * limit;
    const [data, totalCount] = await Promise.all([
        ShiftModel.find(query).sort({ openedAt: -1 }).skip(skip).limit(limit).lean(),
        ShiftModel.countDocuments(query),
    ]);

    return res.json({
        success: true,
        message: 'Shifts fetched',
        data,
        totalCount,
        totalNoPage: Math.ceil(totalCount / limit),
    });
});

// ---------------------------------------------------------------
// GET /api/admin/pos/shift/:id
// A single shift with its drawer summary. Sellers can only see their own.
// ---------------------------------------------------------------
export const getShift = asyncHandler(async (req, res) => {
    const shift = await ShiftModel.findById(req.params.id);
    if (!shift) throw ApiError.notFound('Shift not found');

    if (!canManageAll(req) && String(shift.cashier?.id) !== String(req.adminDoc?._id)) {
        throw ApiError.forbidden('You can only view your own shifts');
    }

    // Closed shifts carry their snapshot; open ones get live figures.
    const summary = shift.status === 'open' ? await summarizeShift(shift) : null;
    return ok(res, { shift: shift.toObject(), summary }, 'Shift fetched');
});
