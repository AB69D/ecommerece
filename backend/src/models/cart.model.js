import mongoose, { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const cartItemSchema = new Schema({
    productId: {
        type: String,
        default: null
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
        default: 1,
        min: 1
    },
    weight: {
        type: String,
        default: ''
    },
    weightIndex: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        default: 0
    },
    discountPercent: {
        type: Number,
        default: 0
    }
}, { _id: true });

const cartSchema = new Schema({
    guestId: {
        type: String,
        required: true
    },
    items: [cartItemSchema],
    totalAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

cartSchema.plugin(tenantPlugin);

// One cart per guest PER TENANT (was global-unique on guestId).
cartSchema.index({ tenantId: 1, guestId: 1 }, { unique: true });

const CartModel = model('Cart', cartSchema);

export default CartModel;