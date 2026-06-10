import { Schema, model } from 'mongoose';

// ---------------------------------------------------------------
// POS shift / cash-drawer session.
//
// A shift is a single cashier's till session: opened with a starting
// float of cash, tracks any mid-shift cash movements (pay-ins / pay-outs),
// and is closed with a counted-cash reconciliation that produces a
// "Z-report" (expected vs. counted, with the over/short difference).
//
// POS sales rung up while a shift is open are stamped with its `_id`
// (Order.shiftId) so the close can total cash/card/other takings.
// ---------------------------------------------------------------

// A mid-shift drawer movement: cash paid in (e.g. extra float) or paid
// out (e.g. petty cash, supplier payment) outside of a sale.
const movementSchema = new Schema(
    {
        type: { type: String, enum: ['in', 'out'], required: true },
        amount: { type: Number, required: true, min: 0 },
        reason: { type: String, default: '' },
        at: { type: Date, default: Date.now },
        by: {
            id: { type: String, default: null },
            username: { type: String, default: null },
        },
    },
    { _id: false },
);

const shiftSchema = new Schema(
    {
        // Cashier who owns the session. Indexed via the partial unique index
        // declared below (scoped to open shifts).
        cashier: {
            id: { type: String, required: true },
            username: { type: String, default: null },
            fullName: { type: String, default: null },
        },
        status: {
            type: String,
            enum: ['open', 'closed'],
            default: 'open',
            index: true,
        },
        // Starting cash in the drawer.
        openingFloat: { type: Number, default: 0, min: 0 },
        openedAt: { type: Date, default: Date.now },
        closedAt: { type: Date, default: null },
        // Mid-shift pay-ins / pay-outs.
        movements: { type: [movementSchema], default: [] },
        // Reconciliation snapshot, populated on close.
        closing: {
            countedCash: { type: Number, default: 0 },
            expectedCash: { type: Number, default: 0 },
            difference: { type: Number, default: 0 },
            cashSales: { type: Number, default: 0 },
            cardSales: { type: Number, default: 0 },
            otherSales: { type: Number, default: 0 },
            totalSales: { type: Number, default: 0 },
            orderCount: { type: Number, default: 0 },
            cashIn: { type: Number, default: 0 },
            cashOut: { type: Number, default: 0 },
        },
        note: { type: String, default: '' },
    },
    { timestamps: true },
);

// One cashier can only have a single OPEN shift at a time. A partial index
// scoped to open sessions lets the same cashier accumulate many closed
// shifts in history without tripping the unique constraint.
shiftSchema.index(
    { 'cashier.id': 1 },
    { unique: true, partialFilterExpression: { status: 'open' } },
);

const ShiftModel = model('Shift', shiftSchema);

export default ShiftModel;
