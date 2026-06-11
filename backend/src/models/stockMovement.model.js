import { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// Immutable inventory ledger. One document per stock change for one product
// variant, so the admin can audit exactly why on-hand stock moved over time.
// Records are append-only — they are never updated or deleted in normal use.
const stockMovementSchema = new Schema({
    productId: {
        type: String,
        required: true,
        index: true,
    },
    // Snapshot of the product name at the time of the movement (products can be
    // renamed later, so we store the label seen on the order/adjustment).
    productName: {
        type: String,
        default: '',
    },
    weightIndex: {
        type: Number,
        default: 0,
    },
    weight: {
        type: String,
        default: '',
    },
    // Signed change to on-hand stock. Negative = stock out (a sale), positive =
    // stock in (a return, cancellation restock, or manual top-up).
    delta: {
        type: Number,
        required: true,
    },
    // Resulting on-hand stock after this change, when it is known (manual
    // adjustments read it back). null for sale/return hooks that avoid the
    // extra read on the hot path.
    balanceAfter: {
        type: Number,
        default: null,
    },
    // The kind of event that caused the change.
    reason: {
        type: String,
        enum: ['sale', 'return', 'cancel', 'adjustment'],
        required: true,
        index: true,
    },
    // Where the change originated.
    channel: {
        type: String,
        enum: ['pos', 'ecommerce', 'chatbot', 'admin', 'system'],
        default: 'system',
        index: true,
    },
    // Linked order id (sale / return / cancel). Blank for manual adjustments.
    orderId: {
        type: String,
        default: '',
        index: true,
    },
    // Who triggered the change (admin / POS cashier). All null for a
    // customer-driven storefront or chatbot order.
    actor: {
        id: { type: String, default: null },
        username: { type: String, default: null },
        fullName: { type: String, default: null },
    },
    note: {
        type: String,
        default: '',
    },
}, {
    timestamps: true,
});

stockMovementSchema.index({ tenantId: 1, createdAt: -1 });
stockMovementSchema.index({ tenantId: 1, productId: 1, createdAt: -1 });

stockMovementSchema.plugin(tenantPlugin);

const StockMovementModel = model('StockMovement', stockMovementSchema);

export default StockMovementModel;
