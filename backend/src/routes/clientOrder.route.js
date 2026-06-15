import { Router } from 'express';
import OrderModel from '../models/order.model.js';
import CartModel from '../models/cart.model.js';
import ProductModel from '../models/product.model.js';
import CheckoutLeadModel from '../models/checkoutLead.model.js';
import CouponModel from '../models/coupon.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { evaluateCoupon } from '../lib/coupon.js';
import { recordStockMovements } from '../lib/stockLedger.js';
import { sendOrderConfirmationEmail } from '../lib/orderEmail.js';
import { notifyAdminNewOrder, notifyCustomerOrderCreated } from '../lib/notify.js';
import { optionalCustomer } from '../middlewares/clientAuth.middleware.js';

const clientOrderRouter = Router();

const getGuestId = (req) => {
    return req.headers['guest-id'] || null;
};

clientOrderRouter.post('/create', optionalCustomer, async (req, res) => {
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
        
        const siteSettings = await SiteSettings.findOne().lean();
        const deliveryCharges = {
            local: siteSettings?.delivery?.localCharge ?? 70,
            regional: siteSettings?.delivery?.regionalCharge ?? 100,
            international: 130,
        };

        const deliveryCharge = deliveryCharges[deliveryArea] ?? deliveryCharges.local;
        
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

        // Idempotency: if the client supplied a key and we already created an
        // order for it, return that order instead of placing a duplicate (guards
        // against a double-tapped "Place Order" or a network retry).
        const idempotencyKey = String(req.headers['idempotency-key'] || req.body.idempotencyKey || '').trim() || null;
        if (idempotencyKey) {
            const existingByKey = await OrderModel.findOne({ idempotencyKey });
            if (existingByKey) {
                return res.json({
                    message: "Order placed successfully",
                    data: existingByKey,
                    error: false,
                    success: true
                });
            }
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

        // Defense-in-depth: recalculate the subtotal from authoritative DB prices
        // and reject the order if cart.totalAmount deviates by more than ₹1.
        // The cart /add endpoint already pins prices to DB values, but this guard
        // catches any residual mismatch (e.g. price changed after item was added,
        // or a tampered cart document in the database).
        let serverSubtotal = 0;
        for (const item of cart.items) {
            const weights = weightsByProductId.get(String(item.productId));
            const variant = weights?.[item.weightIndex || 0];
            if (!variant) {
                return res.status(400).json({
                    message: `Product variant not found for "${item.productName}". Please refresh your cart.`,
                    error: true,
                    success: false
                });
            }
            const unitPrice = Number(variant.price) || 0;
            const discount = Number(variant.discountPercent) || 0;
            const effectivePrice = unitPrice * (1 - discount / 100);
            serverSubtotal += effectivePrice * (Number(item.quantity) || 1);
        }
        serverSubtotal = Math.round(serverSubtotal * 100) / 100;
        const cartSubtotal = Math.round((Number(cart.totalAmount) || 0) * 100) / 100;
        // Allow up to 1 BDT difference to absorb floating-point drift, admin
        // price changes that occurred after items were added, and carts created
        // before server-side price pinning was introduced. The order always uses
        // serverSubtotal (the authoritative figure), so this guard is only a
        // user-facing hint for large manipulations — not the security boundary.
        if (Math.abs(serverSubtotal - cartSubtotal) > 1) {
            return res.status(400).json({
                message: "Cart total mismatch. Please refresh your cart and try again.",
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
            totalPrice: item.price * item.quantity,
            costPrice: costFor(item.productId, item.weightIndex || 0)
        }));

        // Use the server-verified subtotal rather than cart.totalAmount so any
        // DB rounding is consistent with what was validated above.
        const subtotal = serverSubtotal;

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

        // Draw down stock with a GUARDED decrement BEFORE persisting the order,
        // so two shoppers can't both buy the last unit (no oversell). Each line
        // only succeeds while that variant still has enough stock; if any line
        // loses the race we roll back every decrement already applied and abort
        // without creating an order.
        const appliedDecrements = [];
        for (const item of orderItems) {
            const idx = item.weightIndex;
            if (idx === undefined || idx === null) continue;
            const result = await ProductModel.updateOne(
                { _id: item.productId, [`weights.${idx}.stock`]: { $gte: item.quantity } },
                { $inc: { [`weights.${idx}.stock`]: -item.quantity } }
            );
            if (result.modifiedCount !== 1) {
                for (const done of appliedDecrements) {
                    await ProductModel.updateOne(
                        { _id: done.productId },
                        { $inc: { [`weights.${done.weightIndex}.stock`]: done.quantity } }
                    );
                }
                return res.status(409).json({
                    message: `Sorry, "${item.productName}" just sold out or no longer has enough stock. Please review your cart and try again.`,
                    error: true,
                    success: false
                });
            }
            appliedDecrements.push(item);
        }

        // Persist the order. Attach the idempotency key when present so a retried
        // submit can't create a duplicate (enforced by the partial unique index).
        const orderDoc = {
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
        };
        if (idempotencyKey) orderDoc.idempotencyKey = idempotencyKey;
        // Link the order to the signed-in customer (if any) for order history.
        if (req.customer) orderDoc.customerId = req.customer._id.toString();

        const order = new OrderModel(orderDoc);
        try {
            await order.save();
        } catch (e) {
            // A concurrent retry with the same idempotency key won the race:
            // hand back the stock we just decremented and return their order.
            if (e?.code === 11000 && idempotencyKey) {
                for (const done of appliedDecrements) {
                    await ProductModel.updateOne(
                        { _id: done.productId },
                        { $inc: { [`weights.${done.weightIndex}.stock`]: done.quantity } }
                    );
                }
                const existing = await OrderModel.findOne({ idempotencyKey });
                if (existing) {
                    return res.json({
                        message: "Order placed successfully",
                        data: existing,
                        error: false,
                        success: true
                    });
                }
            }
            throw e;
        }

        // Count the redemption (best-effort, non-fatal).
        if (couponDoc) {
            try {
                await CouponModel.updateOne({ _id: couponDoc._id }, { $inc: { usedCount: 1 } });
            } catch {
                // ignore
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

        // Email the shopper their confirmation. COD orders are confirmed on the
        // spot, so send now; online orders get theirs once the payment is
        // confirmed (see settlePaid in clientPayment.route.js), so we don't email
        // an unpaid "online" order here. Fire-and-forget + best-effort so it never
        // delays or breaks the checkout response.
        if (order.paymentMethod === 'cash_on_delivery') {
            sendOrderConfirmationEmail(order).catch(() => {});
        }

        // WhatsApp notifications — fire-and-forget, never block the response.
        // Admin alert fires regardless of payment method (merchant needs to know
        // the moment an order lands). Customer confirmation follows the same gate
        // as email: only for COD (confirmed) — online orders get notified after payment.
        notifyAdminNewOrder(order).catch(() => {});
        if (order.paymentMethod === 'cash_on_delivery') {
            notifyCustomerOrderCreated(order).catch(() => {});
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

// Track an order (for customers). Requires BOTH the order ID and the phone it
// was placed with — phone alone used to return every order for that number,
// leaking names/addresses/items to anyone who guessed a phone. Order IDs are
// random, so requiring the pair makes the lookup a capability check, not an
// enumeration. Returns an array (0 or 1) to keep the client rendering simple.
clientOrderRouter.post('/track', async (req, res) => {
    try {
        const phone = String(req.body.phone || '').trim();
        const orderId = String(req.body.orderId || '').trim();

        if (!phone || !orderId) {
            return res.status(400).json({
                message: "Order ID and phone number are required",
                error: true,
                success: false
            });
        }

        const order = await OrderModel.findOne({ orderId, customerPhone: phone });
        const orders = order ? [order] : [];

        res.json({
            message: orders.length ? "Orders found" : "No order matches that ID and phone number",
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