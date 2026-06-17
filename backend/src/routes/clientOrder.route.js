import { Router } from 'express';
import OrderModel from '../models/order.model.js';
import CartModel from '../models/cart.model.js';
import ProductModel from '../models/product.model.js';
import CheckoutLeadModel from '../models/checkoutLead.model.js';
import CouponModel from '../models/coupon.model.js';
import OrderOtpModel from '../models/orderOtp.model.js';
import FlashSaleModel from '../models/flashSale.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { evaluateCoupon } from '../lib/coupon.js';
import { recordStockMovements } from '../lib/stockLedger.js';
import { sendOrderConfirmationEmail } from '../lib/orderEmail.js';
import { notifyAdminNewOrder, notifyCustomerOrderCreated } from '../lib/notify.js';
import { isFeatureEnabled, getSettings, invalidateSettingsCache } from '../lib/siteSettings.js';
import { sendWhatsAppTemplate } from '../lib/whatsapp.js';
import { optionalCustomer, requireCustomer } from '../middlewares/clientAuth.middleware.js';
import { clientReturnRequestController } from '../controllers/order.controller.js';
import { calculateVat, generateMushakInvoiceNo, generateMushak63Html } from '../lib/vat.js';
import VatInvoiceModel from '../models/VatInvoice.model.js';
import { logger } from '../lib/logger.js';

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
            couponCode = '',
            // COD partial deposit fields (optional — only present when the feature
            // is on and the customer chose to pay an advance).
            depositPaymentMethod = null,
            depositTransactionId = '',
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

        // Resolve active flash sale prices (if any) for items in this cart.
        // We load all currently-live flash sales for this tenant and build a
        // lookup map keyed by `${productId}:${weightIndex}` so the per-item
        // loop below can do O(1) lookups instead of N+1 queries.
        const nowForFlash = new Date();
        const liveFlashSales = await FlashSaleModel.find({
            active: true,
            startsAt: { $lte: nowForFlash },
            endsAt: { $gte: nowForFlash },
        }).lean();

        // Map: `${productId}:${weightIndex}` -> { saleId, itemId, salePrice, maxQty, soldQty }
        const flashPriceMap = new Map();
        for (const sale of liveFlashSales) {
            for (const si of sale.items) {
                const key = `${si.productId}:${si.weightIndex}`;
                // If two overlapping sales apply to the same variant, the lower price wins.
                if (!flashPriceMap.has(key) || si.salePrice < flashPriceMap.get(key).salePrice) {
                    flashPriceMap.set(key, {
                        saleId: sale._id,
                        itemId: si._id,
                        salePrice: si.salePrice,
                        maxQty: si.maxQty,   // null = unlimited
                        soldQty: si.soldQty,
                    });
                }
            }
        }

        // Defense-in-depth: recalculate the subtotal from authoritative DB prices
        // and reject the order if cart.totalAmount deviates by more than ₹1.
        // The cart /add endpoint already pins prices to DB values, but this guard
        // catches any residual mismatch (e.g. price changed after item was added,
        // or a tampered cart document in the database).
        // When a flash sale is active, the authoritative server price IS the flash
        // price — not the product's regular price — so the subtotal guard uses
        // flash prices where applicable.
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

            const flashKey = `${item.productId}:${item.weightIndex || 0}`;
            const flashEntry = flashPriceMap.get(flashKey);

            let effectivePrice;
            if (flashEntry) {
                // Flash sale price overrides the regular/discounted price.
                // Validate that the quantity cap has not been exceeded.
                if (flashEntry.maxQty !== null && (flashEntry.soldQty + (Number(item.quantity) || 1)) > flashEntry.maxQty) {
                    return res.status(400).json({
                        message: `Flash sale limit reached for "${item.productName}". Please adjust the quantity or try again later.`,
                        error: true,
                        success: false
                    });
                }
                effectivePrice = flashEntry.salePrice;
            } else {
                const unitPrice = Number(variant.price) || 0;
                const discount = Number(variant.discountPercent) || 0;
                effectivePrice = unitPrice * (1 - discount / 100);
            }

            serverSubtotal += effectivePrice * (Number(item.quantity) || 1);
        }
        serverSubtotal = Math.round(serverSubtotal * 100) / 100;
        const cartSubtotal = Math.round((Number(cart.totalAmount) || 0) * 100) / 100;
        // Allow up to 1 BDT difference to absorb floating-point drift, admin
        // price changes that occurred after items were added, and carts created
        // before server-side price pinning was introduced. The order always uses
        // serverSubtotal (the authoritative figure), so this guard is only a
        // user-facing hint for large manipulations — not the security boundary.
        //
        // When a flash sale applies, serverSubtotal < cartSubtotal (the server
        // gives a lower flash price). We allow serverSubtotal to be less than
        // cartSubtotal without limit — the buyer pays the lower price. We only
        // reject when serverSubtotal is MORE than cartSubtotal + 1 (i.e. the
        // server price is HIGHER than what was shown to the buyer, which
        // indicates a price-change manipulation or data corruption).
        if (serverSubtotal - cartSubtotal > 1) {
            return res.status(400).json({
                message: "Cart total mismatch. Please refresh your cart and try again.",
                error: true,
                success: false
            });
        }

        // Build order items. When a flash sale applies to a variant, override the
        // stored cart price with the flash price so line totals are correct. The
        // serverSubtotal calculated above already used flash prices for validation,
        // so these two calculations must stay in sync.
        const orderItems = cart.items.map(item => {
            const flashKey = `${item.productId}:${item.weightIndex || 0}`;
            const flashEntry = flashPriceMap.get(flashKey);
            const effectivePrice = flashEntry ? flashEntry.salePrice : item.price;
            return {
                productId: item.productId,
                productName: item.productName,
                productImage: item.productImage,
                quantity: item.quantity,
                weight: item.weight,
                weightIndex: item.weightIndex || 0,
                price: effectivePrice,
                totalPrice: effectivePrice * item.quantity,
                costPrice: costFor(item.productId, item.weightIndex || 0),
            };
        });

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

        // Resolve COD partial deposit settings. A deposit is recorded when:
        //   (a) the codPartialDeposit feature is ON for this tenant, AND
        //   (b) the order uses cash_on_delivery, AND
        //   (c) the customer provided a depositTransactionId.
        // We read the amount from SiteSettings so the customer can never
        // inflate/deflate it client-side.
        let depositAmountToSave = 0;
        let depositMethodToSave = null;
        let depositTxIdToSave = '';
        if (
            paymentMethod === 'cash_on_delivery' &&
            depositPaymentMethod &&
            String(depositTransactionId || '').trim().length >= 4
        ) {
            const depositFeatureOn = await isFeatureEnabled('codPartialDeposit', false);
            if (depositFeatureOn) {
                depositAmountToSave = Number(siteSettings?.codDeposit?.amount) || 100;
                depositMethodToSave = ['bkash', 'nagad', 'rocket'].includes(depositPaymentMethod)
                    ? depositPaymentMethod
                    : null;
                depositTxIdToSave = String(depositTransactionId).trim();
            }
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
            notes,
            depositAmount: depositAmountToSave,
            depositPaymentMethod: depositMethodToSave,
            depositTransactionId: depositTxIdToSave,
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

        // Atomically increment soldQty on each flash sale item that was used in
        // this order. The $expr guard re-checks the cap so that if two concurrent
        // checkouts both passed the pre-check above, only one can breach the cap —
        // the other's increment is silently dropped (the order is already placed,
        // so the cap is a soft best-effort limit, not a hard stock guard, which
        // is handled separately by the product stock decrement above).
        for (const item of orderItems) {
            const flashKey = `${item.productId}:${item.weightIndex}`;
            const flashEntry = flashPriceMap.get(flashKey);
            if (!flashEntry) continue;
            try {
                const updateFilter = {
                    _id: flashEntry.saleId,
                    'items._id': flashEntry.itemId,
                };
                // Only enforce the cap if maxQty is set (not unlimited).
                if (flashEntry.maxQty !== null) {
                    updateFilter.$expr = {
                        $lte: [
                            { $add: [
                                { $arrayElemAt: [
                                    '$items.soldQty',
                                    { $indexOfArray: ['$items._id', flashEntry.itemId] }
                                ]},
                                item.quantity,
                            ]},
                            flashEntry.maxQty,
                        ],
                    };
                }
                await FlashSaleModel.updateOne(updateFilter, {
                    $inc: { 'items.$.soldQty': item.quantity },
                });
            } catch {
                // Non-fatal — soldQty is a reporting counter, not a hard gate.
            }
        }

        // ── VAT Invoice generation ────────────────────────────────────────────
        // Fire-and-forget: VAT invoice failure NEVER blocks the checkout response.
        try {
            const vatEnabled = await isFeatureEnabled('vatEnabled', false);
            if (vatEnabled) {
                const vatSettings = (await getSettings())?.vat;
                if (vatSettings?.rate > 0 && vatSettings?.registrationNumber) {
                    const { taxableAmount, vatAmount } = calculateVat(
                        subtotal,
                        discount || 0,
                        vatSettings.rate,
                    );
                    // Atomically increment mushakCounter to get a unique sequential number
                    const updatedSettings = await SiteSettings.findOneAndUpdate(
                        { tenantId: req.tenantId },
                        { $inc: { 'vat.mushakCounter': 1 } },
                        { new: true },
                    );
                    const invoiceNo = generateMushakInvoiceNo(
                        vatSettings.mushakPrefix || 'MSHK',
                        updatedSettings.vat.mushakCounter,
                    );
                    const buyerAddress = [order.shippingAddress, order.city].filter(Boolean).join(', ');
                    const vatInvoice = await VatInvoiceModel.create({
                        tenantId: req.tenantId,
                        invoiceNo,
                        orderId: order._id,
                        invoiceDate: new Date(),
                        sellerBin: vatSettings.registrationNumber,
                        sellerName: vatSettings.businessName || '',
                        sellerAddress: vatSettings.businessAddress || '',
                        buyerName: order.customerName || '',
                        buyerPhone: order.customerPhone || '',
                        buyerAddress,
                        buyerBin: '',
                        items: orderItems.map(item => {
                            const lineSubtotal = (item.price || 0) * (item.quantity || 1);
                            const lineVat = Math.round(lineSubtotal * vatSettings.rate / 100 * 100) / 100;
                            return {
                                name: item.productName || '',
                                quantity: item.quantity || 1,
                                unitPrice: item.price || 0,
                                discountAmount: 0,
                                taxableAmount: lineSubtotal,
                                vatRate: vatSettings.rate,
                                vatAmount: lineVat,
                                total: lineSubtotal + lineVat,
                            };
                        }),
                        subtotal,
                        discountAmount: discount || 0,
                        taxableAmount,
                        vatRate: vatSettings.rate,
                        vatAmount,
                        deliveryCharge: deliveryCharge || 0,
                        grandTotal: totalAmount + vatAmount,
                        paymentMethod: order.paymentMethod || '',
                    });
                    await OrderModel.updateOne(
                        { _id: order._id },
                        {
                            $set: {
                                vatAmount,
                                vatRate: vatSettings.rate,
                                taxableAmount,
                                vatInvoiceId: vatInvoice._id,
                                vatInvoiceNo: invoiceNo,
                            },
                        },
                    );
                    await invalidateSettingsCache();
                }
            }
        } catch (vatErr) {
            logger.error({ err: vatErr }, 'VAT invoice generation failed for order ' + orderId);
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

        // COD OTP Verification — only for COD orders when the feature is enabled.
        // We create the OTP doc and send the code via WhatsApp before responding
        // so the frontend knows immediately whether to show the verification step.
        if (order.paymentMethod === 'cash_on_delivery') {
            const otpFeatureOn = await isFeatureEnabled('codOtpVerification', false);
            if (otpFeatureOn) {
                try {
                    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
                    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h
                    await OrderOtpModel.create({
                        orderId: order._id,
                        orderRef: order.orderId,
                        phone: order.customerPhone,
                        code: otpCode,
                        expiresAt,
                    });
                    // Send the OTP via WhatsApp — best-effort, failure is logged but
                    // not fatal. The customer can request a resend from the OTP screen.
                    sendWhatsAppTemplate({
                        to: order.customerPhone,
                        template: 'Your {{store}} order verification code is {{otp}}. Valid for 24 hours. Do not share this code.',
                        vars: { otp: otpCode, store: 'the store' },
                    }).catch(() => {});
                    return res.json({
                        message: 'Order placed. Please verify your phone to confirm.',
                        data: { ...order.toObject(), requiresOtpVerification: true },
                        error: false,
                        success: true,
                    });
                } catch (otpErr) {
                    // OTP creation failed (e.g. DB error). Fall through to the normal
                    // response so the order is not lost — the customer gets the order
                    // without the verification step this time.
                    console.error('COD OTP create error:', otpErr);
                }
            }
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

// ── COD OTP Verification ────────────────────────────────────────────────────
// Verify the 6-digit OTP sent via WhatsApp after a COD order was placed.
// No auth required — the guest can verify using the orderId (URL param, the
// human-readable GG-XXXX string) returned by /create.
clientOrderRouter.post('/:orderId/verify-otp', async (req, res) => {
    try {
        const { orderId } = req.params;                          // human-readable GG-XXXX
        const code = String(req.body.code || '').trim();

        if (!code || code.length !== 6) {
            return res.status(400).json({ message: 'Please enter the 6-digit code.', success: false, error: true });
        }

        const otpDoc = await OrderOtpModel.findOne({
            orderRef: orderId,
            verified: false,
            voided: false,
            expiresAt: { $gt: new Date() },
        });

        if (!otpDoc) {
            return res.status(400).json({ message: 'OTP expired or not found. Please request a new code.', success: false, error: true });
        }

        // Exceeded attempt limit — void and refuse.
        if (otpDoc.attempts >= 3) {
            await OrderOtpModel.updateOne({ _id: otpDoc._id }, { $set: { voided: true } });
            // Cancel the order so stock is not held indefinitely for a fraudulent entry.
            await OrderModel.updateOne({ _id: otpDoc.orderId }, { $set: { orderStatus: 'cancelled', cancelledAt: new Date(), cancelledReason: 'OTP verification failed — max attempts exceeded' } });
            return res.status(400).json({ message: 'Too many incorrect attempts. Your order has been cancelled.', success: false, error: true });
        }

        if (code !== otpDoc.code) {
            const newAttempts = otpDoc.attempts + 1;
            await OrderOtpModel.updateOne({ _id: otpDoc._id }, { $inc: { attempts: 1 } });
            const attemptsLeft = 3 - newAttempts;
            return res.status(400).json({
                message: `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`,
                attemptsLeft,
                success: false,
                error: true,
            });
        }

        // Code is correct — mark verified.
        await OrderOtpModel.updateOne({ _id: otpDoc._id }, { $set: { verified: true } });

        return res.json({ message: 'Phone verified. Your order is confirmed.', success: true, error: false });
    } catch (err) {
        console.error('OTP verify error:', err);
        res.status(500).json({ message: err.message, success: false, error: true });
    }
});

// Resend the OTP for a placed COD order. Generates a new code, resets the
// attempt counter, and extends expiry by another 24 hours.
clientOrderRouter.post('/:orderId/resend-otp', async (req, res) => {
    try {
        const { orderId } = req.params;

        // Confirm the order exists and is still pending (not cancelled/delivered).
        const order = await OrderModel.findOne({ orderId, paymentMethod: 'cash_on_delivery', orderStatus: 'pending' });
        if (!order) {
            return res.status(404).json({ message: 'Order not found or no longer pending.', success: false, error: true });
        }

        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        // Replace any existing OTP for this order (upsert by orderId).
        await OrderOtpModel.findOneAndUpdate(
            { orderId: order._id },
            { $set: { code: newCode, attempts: 0, verified: false, voided: false, expiresAt, phone: order.customerPhone } },
            { upsert: true, new: true },
        );

        sendWhatsAppTemplate({
            to: order.customerPhone,
            template: 'Your new verification code is {{otp}}. Valid for 24 hours.',
            vars: { otp: newCode },
        }).catch(() => {});

        return res.json({ message: 'A new OTP has been sent to your WhatsApp.', success: true, error: false });
    } catch (err) {
        console.error('OTP resend error:', err);
        res.status(500).json({ message: err.message, success: false, error: true });
    }
});

// Customer return request — requires a signed-in customer.
// The customer must own the order (customerId match), it must be 'delivered',
// and the returnAvailableUntil window must not have passed.
clientOrderRouter.post('/:orderId/return-request', requireCustomer, clientReturnRequestController);

// ── VAT invoice (customer-facing) ─────────────────────────────────────────────
// Returns the Mushak 6.3 HTML invoice for a given order. The caller must
// supply ?phone=<order-phone> as a basic capability check (no auth needed).
// ?format=json returns JSON instead of HTML.
clientOrderRouter.get('/:orderId/vat-invoice', async (req, res) => {
    try {
        const { orderId: orderParam } = req.params;
        const { phone, format } = req.query;

        let orderQuery = {};
        if (orderParam.length === 24 && /^[0-9a-f]+$/i.test(orderParam)) {
            // Could be a MongoDB ObjectId — try both
            orderQuery = { orderId: orderParam };
        } else {
            orderQuery = { orderId: orderParam };
        }

        const order = await OrderModel.findOne(orderQuery).lean();
        if (!order) {
            return res.status(404).json({ message: 'Order not found', success: false, error: true });
        }

        // Phone check — require caller to know the phone number on the order
        if (phone && order.customerPhone) {
            if (String(phone).trim() !== String(order.customerPhone).trim()) {
                return res.status(403).json({ message: 'Phone number does not match this order', success: false, error: true });
            }
        }

        if (!order.vatInvoiceId) {
            return res.status(404).json({ message: 'No VAT invoice has been generated for this order', success: false, error: true });
        }

        const invoice = await VatInvoiceModel.findById(order.vatInvoiceId).lean();
        if (!invoice) {
            return res.status(404).json({ message: 'VAT invoice record not found', success: false, error: true });
        }

        if (format === 'json') {
            return res.json({ message: 'VAT invoice', data: invoice, success: true, error: false });
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(generateMushak63Html(invoice));
    } catch (err) {
        logger.error({ err }, 'VAT invoice fetch error');
        res.status(500).json({ message: err.message, success: false, error: true });
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