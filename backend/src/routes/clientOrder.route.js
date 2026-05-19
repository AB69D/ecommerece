import { Router } from 'express';
import OrderModel from '../models/order.model.js';
import CartModel from '../models/cart.model.js';
import ProductModel from '../models/product.model.js';

const clientOrderRouter = Router();

const getGuestId = (req) => {
    return req.headers['guest-id'] || null;
};

clientOrderRouter.post('/create', async (req, res) => {
    try {
        const { 
            customerName, 
            customerPhone, 
            customerEmail, 
            shippingAddress, 
            deliveryArea = 'inside_dhaka',
            paymentMethod = 'cash_on_delivery',
            notes = ''
        } = req.body;
        
        const deliveryCharges = {
            inside_dhaka: 70,
            outside_dhaka: 100,
            outside_bangladesh: 130
        };

        const deliveryCharge = deliveryCharges[deliveryArea] || 70;
        
        let guestId = getGuestId(req);

        if (!guestId) {
            return res.status(400).json({
                message: "Guest ID required",
                error: true,
                success: false
            });
        }

        let cart = await CartModel.findOne({ guestId });

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                message: "Cart is empty",
                error: true,
                success: false
            });
        }

        if (!customerName || !customerPhone || !shippingAddress) {
            return res.status(400).json({
                message: "Please provide all required fields",
                error: true,
                success: false
            });
        }

        // Use stored product info directly
        const orderItems = cart.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            quantity: item.quantity,
            weight: item.weight,
            weightIndex: item.weightIndex || 0,
            price: item.price,
            totalPrice: item.price * item.quantity
        }));

        const subtotal = cart.totalAmount;
        const totalAmount = subtotal + deliveryCharge;

        // Generate order ID
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 7).toUpperCase();
        const orderId = `GG-${timestamp}${random}`;

        const order = new OrderModel({
            orderId,
            guestId,
            customerName,
            customerPhone,
            customerEmail: customerEmail || '',
            shippingAddress,
            city: deliveryArea,
            items: orderItems,
            subtotal,
            deliveryCharge,
            totalAmount,
            paymentMethod,
            notes
        });

        await order.save();

        // Decrease stock for each item
        for (const item of orderItems) {
            if (item.weightIndex !== undefined && item.weightIndex !== null) {
                await ProductModel.updateOne(
                    { _id: item.productId },
                    { $inc: { [`weights.${item.weightIndex}.stock`]: -item.quantity } }
                );
            }
        }
        
        // Clear cart after order
        await CartModel.deleteOne({ guestId });

        res.json({
            message: "Order placed successfully",
            data: order,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Order create error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

clientOrderRouter.get('/list', async (req, res) => {
    try {
        let guestId = getGuestId(req);

        if (!guestId) {
            return res.json({
                message: "Order list",
                data: [],
                error: false,
                success: true
            });
        }

        const orders = await OrderModel.find({ guestId }).sort({ createdAt: -1 });

        res.json({
            message: "Order list",
            data: orders,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Order list error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

// Track order by phone number (for customers)
clientOrderRouter.post('/track', async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({
                message: "Phone number is required",
                error: true,
                success: false
            });
        }

        const orders = await OrderModel.find({ customerPhone: phone }).sort({ createdAt: -1 });

        res.json({
            message: "Orders found",
            data: orders,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Track order error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

clientOrderRouter.get('/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;
        let guestId = getGuestId(req);

        const query = { orderId };
        if (guestId) {
            query.guestId = guestId;
        }

        const order = await OrderModel.findOne(query);

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        res.json({
            message: "Order details",
            data: order,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Order get error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

export default clientOrderRouter;