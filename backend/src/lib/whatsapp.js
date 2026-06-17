import { logger } from './logger.js';

// ── WhatsApp Cloud API helper ────────────────────────────────────────────────
//
// Sends free-form text messages via the WhatsApp Business Cloud API
// (graph.facebook.com/v19.0/{phoneNumberId}/messages).
//
// Required env vars (set per-tenant in site settings OR globally):
//   WHATSAPP_TOKEN         — permanent system-user access token (never the
//                            temporary "test" token from the API Explorer).
//   WHATSAPP_PHONE_ID      — the Sender Phone Number ID from Meta Business Suite
//                            (NOT the display number; e.g. "123456789012345").
//
// These are global (not per-tenant) because they belong to ONE WhatsApp Business
// Account. A tenant's *businessNumber* (stored in site settings) is the admin's
// personal phone that receives admin alerts — it's NOT the sender.
//
// For Bangladesh merchants, a simple text message is perfect: no template
// pre-approval needed if you initiate within a 24-hour session window OR use a
// pre-approved Message Template for the first outbound contact. For order alerts
// (customer-initiated checkout flow), we stay within the 24-hour window. Admin
// "new order" alerts use a template approach below.
//
// Best-effort contract: sendWhatsApp() never throws. Callers use fire-and-forget
// (.catch(() => {})) since a failed WA message must never block the HTTP response.

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Substitute {{placeholder}} tokens in a template string.
const interpolate = (template, vars = {}) =>
    template.replace(/\{\{(\w+)\}\}/g, (_m, key) => vars[key] ?? '');

// Low-level send via WhatsApp Cloud API. Returns { ok, messageId } or
// { ok: false, error }.
const callGraphApi = async ({ to, text }) => {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
        return { ok: false, error: 'WHATSAPP_TOKEN or WHATSAPP_PHONE_ID not configured' };
    }

    // Normalise to E.164 without '+' (the format Meta expects).
    const recipient = String(to).replace(/\D/g, '');
    if (recipient.length < 7) {
        return { ok: false, error: `Invalid recipient phone: ${to}` };
    }

    const body = {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: text },
    };

    try {
        const res = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
            const errMsg = json?.error?.message || `HTTP ${res.status}`;
            return { ok: false, error: errMsg };
        }

        const messageId = json?.messages?.[0]?.id || null;
        return { ok: true, messageId };
    } catch (err) {
        return { ok: false, error: err.message };
    }
};

// ── Public helpers ────────────────────────────────────────────────────────────

// Send a templated WhatsApp message to a customer (order confirmation / status).
//
// @param {object} opts
//   to           — recipient phone (E.164 without '+')
//   template     — template string with {{name}} etc. placeholders
//   vars         — substitution map
//
// Returns { ok, messageId } or { ok: false, error, skipped }.
export const sendWhatsAppTemplate = async ({ to, template, vars = {} }) => {
    if (!to) return { ok: false, skipped: true, error: 'no-recipient' };
    if (!template) return { ok: false, skipped: true, error: 'no-template' };

    const text = interpolate(template, vars);
    return callGraphApi({ to, text });
};

// Send the "new order" admin alert to the store owner's business number.
//
// Message format (hardcoded, not template-substituted, so the admin sees a
// clean summary on their phone without needing to configure anything):
//   🛒 New Order #GG-XXX — John Doe — 1250 BDT — Cash on Delivery
//
// @param {object} order  — saved Mongoose order doc or plain object
// @param {string} businessNumber — store owner's phone from siteSettings.whatsapp.businessNumber
export const sendAdminNewOrderAlert = async (order, businessNumber) => {
    if (!businessNumber) return { ok: false, skipped: true, error: 'no-business-number' };

    const paymentLabels = {
        cash_on_delivery: 'Cash on Delivery',
        online: 'Paid Online',
        bkash: 'bKash',
        nagad: 'Nagad',
        rocket: 'Rocket',
        cash: 'Cash',
        card: 'Card',
    };

    const paymentLabel = paymentLabels[order.paymentMethod] || order.paymentMethod || 'Unknown';
    const amount = Number(order.totalAmount || 0).toFixed(0);
    const text =
        `🛒 New Order #${order.orderId} — ${order.customerName} — ${amount} BDT — ${paymentLabel}`;

    logger.debug({ orderId: order.orderId, to: businessNumber }, 'Sending admin WhatsApp alert');
    return callGraphApi({ to: businessNumber, text });
};

// Send a customer-facing order status update via WhatsApp.
//
// @param {object} order    — saved Mongoose order doc
// @param {string} template — statusTemplate from siteSettings.whatsapp
export const sendCustomerStatusAlert = async (order, template) => {
    if (!order?.customerPhone) return { ok: false, skipped: true, error: 'no-customer-phone' };

    const vars = {
        name: order.customerName || 'there',
        orderId: order.orderId,
        total: `${Number(order.totalAmount || 0).toFixed(0)} BDT`,
        status: order.orderStatus,
    };

    return sendWhatsAppTemplate({ to: order.customerPhone, template, vars });
};

// Send a customer-facing order confirmation via WhatsApp.
//
// @param {object} order    — saved Mongoose order doc
// @param {string} template — orderTemplate from siteSettings.whatsapp
export const sendCustomerOrderConfirmation = async (order, template) => {
    if (!order?.customerPhone) return { ok: false, skipped: true, error: 'no-customer-phone' };

    const vars = {
        name: order.customerName || 'there',
        orderId: order.orderId,
        total: `${Number(order.totalAmount || 0).toFixed(0)} BDT`,
        status: order.orderStatus || 'pending',
    };

    return sendWhatsAppTemplate({ to: order.customerPhone, template, vars });
};

// Send an abandoned-cart recovery WhatsApp message to a checkout lead.
//
// @param {string} phone        — customer phone (E.164 without '+')
// @param {string} name         — customer name
// @param {number} itemCount    — number of items in cart
// @param {number} cartValue    — cart total value
// @param {string} checkoutUrl  — full URL of the storefront checkout page
// @param {string} template     — recoveryTemplate from siteSettings.whatsapp
//
// Returns { ok, messageId } or { ok: false, error, skipped }.
export const sendAbandonedCartRecovery = async (phone, name, itemCount, cartValue, checkoutUrl, template) => {
    if (!phone) return { ok: false, skipped: true, error: 'no-recipient' };
    if (!template) return { ok: false, skipped: true, error: 'no-template' };

    const vars = {
        name: name || 'there',
        itemCount: String(itemCount || 1),
        cartValue: Number(cartValue || 0).toFixed(0),
        checkoutUrl: checkoutUrl || '',
    };

    return sendWhatsAppTemplate({ to: phone, template, vars });
};
