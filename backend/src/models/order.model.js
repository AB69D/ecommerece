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
    totalAmount: {
        type: Number,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['cash_on_delivery', 'online'],
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