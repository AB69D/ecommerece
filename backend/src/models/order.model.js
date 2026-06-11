import mongoose, { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const orderItemSchema = new Schema({
    productId: {
        type: String,
        default: ''
    },
    productName: {
        type: String,
        default: ''
    },
    productImage: {
        type: String,
        default: ''
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    weight: {
        type: String,
        default: ''
    },
    price: {
        type: Number,
        required: true
    },
    totalPrice: {
        type: Number,
        required: true
    },
    // Unit cost of this variant captured at sale time, so profit/margin
    // reports reflect the cost as it was when sold (not today's cost).
    // Defaults to 0 so historical orders and cost-less products are valid.
    costPrice: {
        type: Number,
        default: 0
    },
    weightIndex: {
        type: Number,
        default: 0
    }
});

const orderSchema = new Schema({
    orderId: {
        type: String,
        required: true
    },
    // Where the sale originated. 'ecommerce' = storefront checkout (default,
    // keeps all historical orders valid), 'pos' = in-store POS terminal.
    source: {
        type: String,
        enum: ['ecommerce', 'pos'],
        default: 'ecommerce',
        index: true
    },
    // For POS orders: 'retail' (normal walk-in price) or 'wholesale'
    // (cashier-overridden per-line unit price). null for ecommerce orders.
    saleType: {
        type: String,
        enum: ['retail', 'wholesale', null],
        default: null
    },
    // Snapshot of the POS cashier who rang up the sale. null for ecommerce.
    soldBy: {
        id: { type: String, default: null },
        username: { type: String, default: null },
        fullName: { type: String, default: null }
    },
    // The open POS shift this sale was attributed to (Shift._id), when the
    // posShift feature is enabled. null for ecommerce / shift-less sales.
    shiftId: {
        type: String,
        default: null,
        index: true
    },
    guestId: {
        type: String,
        required: true
    },
    customerName: {
        type: String,
        required: true
    },
    customerPhone: {
        type: String,
        required: true
    },
    customerEmail: String,
    shippingAddress: {
        type: String,
        required: true
    },
    city: String,
    items: [orderItemSchema],
    subtotal: {
        type: Number,
        required: true
    },
    deliveryCharge: {
        type: Number,
        default: 0
    },
    // Cart-level coupon applied to this order (blank when none).
    couponCode: {
        type: String,
        default: ''
    },
    discount: {
        type: Number,
        default: 0
    },
    // Manual ad-hoc markdown applied at the POS counter (separate from a
    // coupon) — e.g. a wholesale discount. The computed `amount` is also folded
    // into `discount` above so revenue/profit reports stay correct; this
    // sub-doc only preserves the percent/flat breakdown for the receipt.
    manualDiscount: {
        type: {
            type: String,
            enum: ['percent', 'flat', null],
            default: null
        },
        value: { type: Number, default: 0 },
        amount: { type: Number, default: 0 }
    },
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        // cash_on_delivery / online -> e-commerce; cash / card -> POS counter
        enum: ['cash_on_delivery', 'online', 'cash', 'card'],
        default: 'cash_on_delivery'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    orderStatus: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'],
        default: 'pending'
    },
    deliveryDate: {
        type: Date,
        default: null
    },
    returnAvailableUntil: {
        type: Date,
        default: null
    },
    confirmedAt: {
        type: Date,
        default: null
    },
    deliveredAt: {
        type: Date,
        default: null
    },
    cancelledAt: {
        type: Date,
        default: null
    },
    cancelledReason: {
        type: String,
        default: ''
    },
    notes: String,
    adminNotes: {
        type: String,
        default: ''
    },
    // Set when a signed-in customer places the order, linking it to their
    // account for order history. Null for guest and POS orders.
    customerId: {
        type: String,
        default: null,
        index: true
    },
    // Optional client-supplied key that makes storefront checkout idempotent: a
    // retried/double-tapped submit carrying the same key returns the original
    // order instead of creating a duplicate. Absent on POS and legacy orders;
    // uniqueness is enforced only when present (partial index below).
    idempotencyKey: {
        type: String
    }
}, {
    timestamps: true
});

// Enforce idempotency-key uniqueness only for orders that actually carry one
// (storefront checkouts). POS/legacy orders without the field are unaffected,
// so this avoids the "duplicate null" collision a plain unique index would hit.
orderSchema.index(
    { tenantId: 1, idempotencyKey: 1 },
    { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

// Hot read paths. Each is compound so the index serves the equality filter AND
// the `createdAt: -1` sort in a single scan (no in-memory sort):
//   - guest order history:  OrderModel.find({ guestId }).sort({ createdAt: -1 })
//   - track-order by phone:  OrderModel.find({ customerPhone }).sort({ createdAt: -1 })
// Without these, every order lookup is a full collection scan that degrades
// linearly as the orders collection grows.
orderSchema.index({ tenantId: 1, guestId: 1, createdAt: -1 });
orderSchema.index({ tenantId: 1, customerPhone: 1, createdAt: -1 });

orderSchema.plugin(tenantPlugin);

// Human order id is unique PER TENANT (was global-unique).
orderSchema.index({ tenantId: 1, orderId: 1 }, { unique: true });

const OrderModel = model('Order', orderSchema);

export default OrderModel;