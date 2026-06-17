import mongoose, { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// Captures a checkout attempt as the customer fills the order form. Lets the
// admin see leads who started but never completed an order ("abandoned
// checkouts"). One document per guest session (keyed by guestId, upserted on
// each capture). When the matching order is placed, the lead is flipped to
// `converted` so it drops out of the abandoned list.
const leadItemSchema = new Schema({
    productName: { type: String, default: '' },
    productImage: { type: String, default: '' },
    quantity: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
}, { _id: false });

const checkoutLeadSchema = new Schema({
    guestId: {
        type: String,
        required: true,
        index: true
    },
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    customerEmail: { type: String, default: '' },
    shippingAddress: { type: String, default: '' },
    deliveryArea: { type: String, default: '' },
    items: [leadItemSchema],
    itemCount: { type: Number, default: 0 },
    cartValue: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['abandoned', 'converted'],
        default: 'abandoned',
        index: true
    },
    convertedOrderId: { type: String, default: '' },
    convertedAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    recoveryAttempts: { type: Number, default: 0 },
    lastRecoveryAt: { type: Date, default: null },
}, {
    timestamps: true
});

checkoutLeadSchema.plugin(tenantPlugin);

// One lead per guest PER TENANT (was global-unique on guestId).
checkoutLeadSchema.index({ tenantId: 1, guestId: 1 }, { unique: true });

const CheckoutLeadModel = model('CheckoutLead', checkoutLeadSchema);

export default CheckoutLeadModel;
