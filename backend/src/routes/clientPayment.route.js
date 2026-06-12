import { Router } from 'express';
import OrderModel from '../models/order.model.js';
import PaymentModel from '../models/payment.model.js';
import { getSettings } from '../lib/siteSettings.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { optionalCustomer } from '../middlewares/clientAuth.middleware.js';
import { initSession, validateTransaction, verifyIpnHash } from '../lib/sslcommerz.js';
import { sendOrderConfirmationEmail } from '../lib/orderEmail.js';
import { runAsSystem, runAsTenant } from '../tenancy/tenantContext.js';

const clientPaymentRouter = Router();

const getGuestId = (req) => req.headers['guest-id'] || null;

// Admin-configured gateway settings. Online payment is "available" only when an
// admin both flipped `enabled` AND saved a Store ID + password. The raw creds
// are always returned (callbacks still need them to validate even if an admin
// later toggled the feature off mid-transaction).
const getPaymentConfig = async () => {
    const s = await getSettings();
    const p = s?.payment || {};
    return {
        enabled: !!p.enabled && !!p.storeId && !!p.storePassword,
        provider: p.provider || 'sslcommerz',
        sandbox: p.sandbox !== false,
        storeId: p.storeId || '',
        storePassword: p.storePassword || '',
    };
};

// Absolute base URL of THIS API for the gateway's server-to-server + browser
// callbacks. Prefer the explicit PUBLIC_API_URL; otherwise derive it from the
// proxied request (trust proxy is on, so protocol/host reflect the public edge).
const apiBase = (req) => {
    const explicit = env.PUBLIC_API_URL ? env.PUBLIC_API_URL.replace(/\/$/, '') : '';
    return explicit || `${req.protocol}://${req.get('host')}`;
};

const frontendBase = () => (env.FRONTEND_URL ? env.FRONTEND_URL.replace(/\/$/, '') : '');

// Human-facing result page the shopper's browser is bounced to after the gateway
// round-trip. It polls /status/:orderId to render the final outcome (and only
// then resets the guest session / fires the purchase pixel).
const resultUrl = (orderId, outcome) =>
    `${frontendBase()}/checkout/payment?order=${encodeURIComponent(orderId || '')}&status=${outcome}`;

// Shared, idempotent settlement. Trust ONLY the Validation API: a callback body
// (browser-posted) is attacker-forgeable, so we re-fetch the transaction by its
// gateway `val_id` and require status VALID/VALIDATED with a matching tran_id and
// amount before crediting the order. The md5 `verify_sign` is a secondary signal
// that is logged but never gates (the validation call is authoritative).
const settlePaid = async ({ tranId, valId, body, source }) => {
    // The gateway callback carries NO tenant (it's a server-to-server / browser
    // POST to a fixed URL), so find the payment ACROSS all stores first.
    const found = await runAsSystem(() => PaymentModel.findOne({ tranId }).exec());
    if (!found) {
        logger.warn({ tranId, source }, 'Payment callback for unknown tran_id');
        return { ok: false, reason: 'unknown_tran' };
    }
    // Everything below MUST run in the payment's OWN store context: the store's
    // gateway credentials (getPaymentConfig), its order, its settings — never the
    // primary fallback. Bind to the payment's tenant for the rest of settlement.
    return runAsTenant(found.tenantId, () => settleInTenant({ payment: found, tranId, valId, body, source }));
};

const settleInTenant = async ({ payment, tranId, valId, body, source }) => {
    // Already settled (the IPN and the browser redirect race each other) — no-op.
    if (payment.status === 'paid') return { ok: true, payment };

    const cfg = await getPaymentConfig(); // THIS store's gateway credentials
    if (!cfg.storeId || !cfg.storePassword) {
        logger.error({ tranId }, 'Cannot validate payment: gateway credentials missing');
        return { ok: false, reason: 'no_credentials' };
    }

    let validation = {};
    try {
        validation = await validateTransaction({
            sandbox: payment.sandbox,
            storeId: cfg.storeId,
            storePassword: cfg.storePassword,
            valId,
        });
    } catch (err) {
        logger.error({ err, tranId }, 'Validation API call failed');
        return { ok: false, reason: 'validation_error' };
    }

    const statusOk = validation.status === 'VALID' || validation.status === 'VALIDATED';
    const tranOk = validation.tran_id === tranId;
    const amountOk = Math.abs(Number(validation.amount) - payment.amount) < 1;

    if (!statusOk || !tranOk || !amountOk) {
        logger.warn(
            { tranId, valId, statusOk, tranOk, amountOk, gatewayStatus: validation.status },
            'Payment failed authoritative validation',
        );
        payment.status = 'failed';
        payment.validationPayload = validation;
        if (source === 'ipn') payment.ipnPayload = body;
        await payment.save();
        return { ok: false, reason: 'validation_failed' };
    }

    if (!verifyIpnHash(body, cfg.storePassword)) {
        // Non-gating: validation already confirmed the money. A mismatch usually
        // just means a redirect callback (which is unsigned) rather than the IPN.
        logger.warn({ tranId, source }, 'Payment hash check did not match (continuing)');
    }

    payment.status = 'paid';
    payment.valId = valId;
    payment.bankTranId = validation.bank_tran_id || body.bank_tran_id || '';
    payment.cardType = validation.card_type || body.card_type || '';
    payment.cardIssuer = validation.card_issuer || body.card_issuer || '';
    payment.validationPayload = validation;
    if (source === 'ipn') payment.ipnPayload = body;
    await payment.save();

    // Credit + confirm the order (guarded so a late duplicate can't double-write).
    const upd = await OrderModel.updateOne(
        { orderId: payment.orderId, paymentStatus: { $ne: 'paid' } },
        {
            $set: {
                paymentStatus: 'paid',
                orderStatus: 'confirmed',
                confirmedAt: new Date(),
            },
        },
    );

    // Only the first settle actually flips the order to paid (modifiedCount===1);
    // email the receipt exactly once, off the response path. Redirect + IPN both
    // call settlePaid, so this guard prevents a duplicate confirmation email.
    if (upd.modifiedCount === 1) {
        OrderModel.findOne({ orderId: payment.orderId })
            .then((ord) => (ord ? sendOrderConfirmationEmail(ord) : null))
            .catch(() => {});
    }

    logger.info({ tranId, orderId: payment.orderId, source }, 'Payment settled');
    return { ok: true, payment };
};

// POST /api/client/payment/init — create a gateway session for an existing order
// and hand back the GatewayPageURL for the browser to redirect to. The order is
// created COD-style first (stock already committed), then paid here.
clientPaymentRouter.post('/init', optionalCustomer, async (req, res) => {
    try {
        const cfg = await getPaymentConfig();
        if (!cfg.enabled) {
            return res.status(400).json({
                message: 'Online payment is not available right now.',
                error: true,
                success: false,
            });
        }

        const orderId = String(req.body.orderId || '').trim();
        if (!orderId) {
            return res
                .status(400)
                .json({ message: 'Order ID is required', error: true, success: false });
        }

        const order = await OrderModel.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ message: 'Order not found', error: true, success: false });
        }

        // Authorize: the request must come from the guest who placed the order or
        // the signed-in customer it belongs to.
        const guestId = getGuestId(req);
        const owns =
            (guestId && order.guestId === guestId) ||
            (req.customer && order.customerId === req.customer._id.toString());
        if (!owns) {
            return res.status(403).json({
                message: 'You are not allowed to pay for this order.',
                error: true,
                success: false,
            });
        }

        if (order.paymentStatus === 'paid') {
            return res
                .status(409)
                .json({ message: 'This order is already paid.', error: true, success: false });
        }

        const tranId = `PAY-${Date.now().toString(36)}${Math.random()
            .toString(36)
            .slice(2, 8)}`.toUpperCase();

        // Audit row first, so an attempt is always recorded even if init fails.
        const payment = await PaymentModel.create({
            tranId,
            orderId: order.orderId,
            orderRef: order._id.toString(),
            guestId: order.guestId,
            customerId: order.customerId || null,
            provider: 'sslcommerz',
            sandbox: cfg.sandbox,
            amount: order.totalAmount,
            currency: 'BDT',
            status: 'initiated',
        });

        const base = apiBase(req);
        const productNames =
            order.items.map((i) => i.productName).filter(Boolean).join(', ').slice(0, 250) ||
            'Order';

        const payload = {
            total_amount: String(order.totalAmount),
            currency: 'BDT',
            tran_id: tranId,
            success_url: `${base}/api/client/payment/success`,
            fail_url: `${base}/api/client/payment/fail`,
            cancel_url: `${base}/api/client/payment/cancel`,
            ipn_url: `${base}/api/client/payment/ipn`,
            shipping_method: 'Courier',
            product_name: productNames,
            product_category: 'general',
            product_profile: 'general',
            num_of_item: String(order.items.length || 1),
            cus_name: order.customerName,
            cus_email: order.customerEmail || 'guest@example.com',
            cus_add1: order.shippingAddress,
            cus_city: order.city || 'Dhaka',
            cus_postcode: '0000',
            cus_country: 'Bangladesh',
            cus_phone: order.customerPhone,
            ship_name: order.customerName,
            ship_add1: order.shippingAddress,
            ship_city: order.city || 'Dhaka',
            ship_postcode: '0000',
            ship_country: 'Bangladesh',
            // Echoed back verbatim on every callback so we can re-link without a
            // lookup race: value_a = our tran_id, value_b = order id.
            value_a: tranId,
            value_b: order.orderId,
        };

        let result = {};
        try {
            result = await initSession({
                sandbox: cfg.sandbox,
                storeId: cfg.storeId,
                storePassword: cfg.storePassword,
                payload,
            });
        } catch (err) {
            logger.error({ err, tranId }, 'SSLCommerz init request failed');
            payment.status = 'failed';
            await payment.save();
            return res.status(502).json({
                message: 'Could not reach the payment gateway. Please try again.',
                error: true,
                success: false,
            });
        }

        if (result.status !== 'SUCCESS' || !result.GatewayPageURL) {
            logger.warn({ tranId, reason: result.failedreason }, 'Gateway rejected payment init');
            payment.status = 'failed';
            payment.validationPayload = result;
            await payment.save();
            return res.status(502).json({
                message: result.failedreason || 'Payment gateway rejected the request.',
                error: true,
                success: false,
            });
        }

        payment.sessionKey = result.sessionkey || '';
        payment.gatewayUrl = result.GatewayPageURL;
        await payment.save();

        return res.json({
            message: 'Payment session created',
            data: { gatewayUrl: result.GatewayPageURL, tranId },
            error: false,
            success: true,
        });
    } catch (error) {
        logger.error({ err: error }, 'Payment init error');
        return res
            .status(500)
            .json({ message: 'Failed to start payment', error: true, success: false });
    }
});

// POST /success — SSLCommerz auto-submits a form to this URL in the shopper's
// browser after a (claimed) successful payment. We DO NOT trust that claim: we
// settle via the Validation API, then redirect the browser to the result page
// reflecting the real outcome.
clientPaymentRouter.post('/success', async (req, res) => {
    const body = req.body || {};
    const tranId = body.value_a || body.tran_id || '';
    const orderId = body.value_b || '';
    try {
        const result = await settlePaid({ tranId, valId: body.val_id, body, source: 'redirect' });
        return res.redirect(303, resultUrl(orderId, result.ok ? 'success' : 'failed'));
    } catch (error) {
        logger.error({ err: error, tranId }, 'Payment success callback error');
        return res.redirect(303, resultUrl(orderId, 'failed'));
    }
});

// POST /fail — gateway reports the attempt failed. Mark the attempt (best-effort)
// and bounce the shopper to the result page. Stock stays committed (matches COD
// semantics) so the order can still be paid/cancelled later.
clientPaymentRouter.post('/fail', async (req, res) => {
    const body = req.body || {};
    const tranId = body.value_a || body.tran_id || '';
    const orderId = body.value_b || '';
    try {
        await runAsSystem(() => PaymentModel.updateOne(
            { tranId, status: { $nin: ['paid', 'refunded'] } },
            { $set: { status: 'failed', ipnPayload: body } },
        ).exec());
    } catch (error) {
        logger.error({ err: error, tranId }, 'Payment fail callback error');
    }
    return res.redirect(303, resultUrl(orderId, 'failed'));
});

// POST /cancel — shopper backed out on the gateway page.
clientPaymentRouter.post('/cancel', async (req, res) => {
    const body = req.body || {};
    const tranId = body.value_a || body.tran_id || '';
    const orderId = body.value_b || '';
    try {
        await runAsSystem(() => PaymentModel.updateOne(
            { tranId, status: { $nin: ['paid', 'refunded'] } },
            { $set: { status: 'cancelled', ipnPayload: body } },
        ).exec());
    } catch (error) {
        logger.error({ err: error, tranId }, 'Payment cancel callback error');
    }
    return res.redirect(303, resultUrl(orderId, 'cancelled'));
});

// POST /ipn — server-to-server notification from SSLCommerz. The authoritative,
// out-of-band confirmation: it can arrive before or after the browser redirect,
// so settlement is idempotent. We always answer 200 so the gateway stops retrying.
clientPaymentRouter.post('/ipn', async (req, res) => {
    const body = req.body || {};
    const tranId = body.value_a || body.tran_id || '';
    try {
        const status = String(body.status || '').toUpperCase();
        if (status === 'VALID' || status === 'VALIDATED') {
            await settlePaid({ tranId, valId: body.val_id, body, source: 'ipn' });
        } else if (status === 'FAILED' || status === 'CANCELLED') {
            // Cross-tenant: the callback carries no store, so update by tran_id in
            // system context (the unique tran_id pins the exact payment).
            await runAsSystem(() => PaymentModel.updateOne(
                { tranId, status: { $nin: ['paid', 'refunded'] } },
                { $set: { status: status === 'FAILED' ? 'failed' : 'cancelled', ipnPayload: body } },
            ).exec());
        }
    } catch (error) {
        logger.error({ err: error, tranId }, 'IPN handling error');
    }
    return res.json({ received: true });
});

// GET /status/:orderId — polled by the result page. Keyed by the random order id
// only (no guest header needed), and returns just enough non-PII state to render
// the outcome. Safe to expose: order ids are unguessable and nothing here leaks
// names/addresses/items.
clientPaymentRouter.get('/status/:orderId', async (req, res) => {
    try {
        const orderId = String(req.params.orderId || '').trim();
        // The result page that polls this lives outside a store path, so the
        // request carries no tenant. The order id is random/unguessable and only
        // non-PII status is returned, so resolve it across stores (system context)
        // rather than letting it fall back to the primary store and 404.
        const order = await runAsSystem(() => OrderModel.findOne({ orderId })
            .select('orderId paymentStatus orderStatus paymentMethod totalAmount')
            .lean());
        if (!order) {
            return res.status(404).json({ message: 'Order not found', error: true, success: false });
        }
        const attempt = await runAsSystem(() => PaymentModel.findOne({ orderId })
            .sort({ createdAt: -1 })
            .select('status')
            .lean());
        return res.json({
            message: 'Payment status',
            data: {
                orderId: order.orderId,
                paymentMethod: order.paymentMethod,
                paymentStatus: order.paymentStatus,
                orderStatus: order.orderStatus,
                attemptStatus: attempt?.status || null,
                paid: order.paymentStatus === 'paid',
            },
            error: false,
            success: true,
        });
    } catch (error) {
        logger.error({ err: error }, 'Payment status error');
        return res
            .status(500)
            .json({ message: 'Failed to load payment status', error: true, success: false });
    }
});

export default clientPaymentRouter;
