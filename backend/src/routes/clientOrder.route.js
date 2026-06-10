import { Router } from 'express';
import OrderModel from '../models/order.model.js';
import CartModel from '../models/cart.model.js';
import ProductModel from '../models/product.model.js';
import CheckoutLeadModel from '../models/checkoutLead.model.js';
import CouponModel from '../models/coupon.model.js';
import { evaluateCoupon } from '../lib/coupon.js';
import { recordStockMovements } from '../lib/stockLedger.js';

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
            deliveryArea = 'local',
            paymentMethod = 'cash_on_delivery',
            notes = '',
            couponCode = ''
        } = req.body;
        
        const deliveryCharges = {
            local: 70,
            regional: 100,
            international: 130
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

        // Snapshot each variant's cost price (for profit reporting) by loading the
        // referenced products once — the cart only stores the sell price.
        const cartProductIds = [...new Set(cart.items.map((it) => it.productId).filter(Boolean))];
        const cartProducts = await ProductModel.find({ _id: { $in: cartProductIds } })
            .select('weights')
            .lean();
        const weightsByProductId = new Map(cartProducts.map((p) => [String(p._id), p.weights || []]));
        const costFor = (productId, weightIndex) => {
            const weights = weightsByProductId.get(String(productId));
            const w = weights?.[weightIndex || 0];
            return Math.round((Number(w?.costPrice) || 0) * 100) / 100;
        };

        // Use stored product info directly
        const orderItems = cart.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            productImage: item.productImage,
            quantity: item.quantity,
            weight: item.weight,
            weightIndex: item.weightIndex || 0,
            price: item.price,
            totalPrice: item.price * item.quantity,
            costPrice: costFor(item.productId, item.weightIndex || 0)
        }));

        const subtotal = cart.totalAmount;

        // Re-validate any coupon server-side (never trust a client discount).
        // A now-invalid code is simply ignored so the order still goes through.
        let discount = 0;
        let appliedCoupon = '';
        let couponDoc = null;
        const wantCoupon = String(couponCode || '').trim().toUpperCase();
        if (wantCoupon) {
            couponDoc = await CouponModel.findOne({ code: wantCoupon });
            const result = evaluateCoupon(couponDoc, { subtotal, channel: 'ecommerce' });
            if (result.ok && result.discount > 0) {
                discount = result.discount;
                appliedCoupon = couponDoc.code;
            } else {
                couponDoc = null;
            }
        }

        const totalAmount = Math.max(0, subtotal - discount) + deliveryCharge;

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
            couponCode: appliedCoupon,
            discount,
            totalAmount,
            paymentMethod,
            notes
        });

        await order.save();

        // Count the redemption (best-effort, non-fatal).
        if (couponDoc) {
            try {
                await CouponModel.updateOne({ _id: couponDoc._id }, { $inc: { usedCount: 1 } });
            } catch {
                // ignore
            }
        }

        // Decrease stock for each item
        for (const item of orderItems) {
            if (item.weightIndex !== undefined && item.weightIndex !== null) {
                await ProductModel.updateOne(
                    { _id: item.productId },
                    { $inc: { [`weights.${item.weightIndex}.stock`]: -item.quantity } }
                );
            }
        }

        // Record the stock draw-down in the ledger (best-effort, feature-gated).
        // Customer-driven, so there is no actor.
        await recordStockMovements(
            orderItems.map((i) => ({
                productId: i.productId,
                productName: i.productName,
                weightIndex: i.weightIndex,
                weight: i.weight,
                delta: -i.quantity,
            })),
            { reason: 'sale', channel: 'ecommerce', orderId }
        );

        // Clear cart after order
        await CartModel.deleteOne({ guestId });

        // Mark any abandoned-checkout lead for this guest as converted so it
        // drops out of the admin "abandoned" list (best-effort).
        try {
            await CheckoutLeadModel.updateOne(
                { guestId },
                { $set: { status: 'converted', convertedOrderId: orderId, convertedAt: new Date() } }
            );
        } catch {
            // non-fatal
        }

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