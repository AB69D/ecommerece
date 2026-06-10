import mongoose, { Schema, model } from 'mongoose';

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
    weightIndex: {
        type: Number,
        default: 0
    }
});

const orderSchema = new Schema({
    orderId: {
        type: String,
        required: true,
        unique: true
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
    }
}, {
    timestamps: true
});

const OrderModel = model('Order', orderSchema);

export default OrderModel;