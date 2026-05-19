import mongoose, { Schema, model } from 'mongoose';

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
        required: true,
        unique: true
    },
    items: [cartItemSchema],
    totalAmount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

const CartModel = model('Cart', cartSchema);

export default CartModel;