import { logger } from './logger.js';
import { getSettings, isFeatureEnabled } from './siteSettings.js';
import {
    sendAdminNewOrderAlert,
    sendCustomerOrderConfirmation,
    sendCustomerStatusAlert,
} from './whatsapp.js';
import NotificationLog from '../models/notificationLog.model.js';

// ── Notification dispatcher ───────────────────────────────────────────────────
//
// Central place that:
//   1. Checks the whatsapp feature flag before doing anything.
//   2. Fires the right WhatsApp helper.
//   3. Persists every attempt (sent / failed / skipped) to NotificationLog so
//      merchants can see what happened from the admin panel.
//
// All functions are best-effort and NEVER THROW. Use fire-and-forget:
//   notifyOrderCreated(order).catch(() => {});

// Persist one notification attempt to the log (best-effort).
const log = async ({ type, template, orderId, recipient, message, status, externalId = '', error = '' }) => {
    try {
        await NotificationLog.create({
            type,
            template,
            orderId: orderId || '',
            recipient,
            message,
            status,
            externalId,
            error,
            sentAt: new Date(),
        });
    } catch (err) {
        // Never let a logging failure surface to the caller.
        logger.warn({ err }, 'Failed to write notification log entry');
    }
};

// ── Improvement 1: Admin alert on new order ───────────────────────────────────
//
// Sends a concise WhatsApp message to the store owner's businessNumber:
//   "🛒 New Order #GG-XXX — John Doe — 1250 BDT — Cash on Delivery"
//
// Gate: features.whatsapp must be true AND whatsapp.businessNumber must be set.
export const notifyAdminNewOrder = async (order) => {
    try {
        const enabled = await isFeatureEnabled('whatsapp', false);
        if (!enabled) return;

        const settings = await getSettings();
        const businessNumber = settings?.whatsapp?.businessNumber;

        if (!businessNumber) {
            logger.debug({ orderId: order.orderId }, 'Admin WhatsApp alert skipped: no businessNumber');
            return;
        }

        const result = await sendAdminNewOrderAlert(order, businessNumber);

        const status = result.skipped ? 'skipped' : result.ok ? 'sent' : 'failed';
        const paymentLabel =
            { cash_on_delivery: 'Cash on Delivery', online: 'Paid Online', bkash: 'bKash', nagad: 'Nagad', rocket: 'Rocket', cash: 'Cash', card: 'Card' }[order.paymentMethod] || order.paymentMethod || 'Unknown';
        const messageText = `🛒 New Order #${order.orderId} — ${order.customerName} — ${Number(order.totalAmount || 0).toFixed(0)} BDT — ${paymentLabel}`;

        await log({
            type: 'whatsapp',
            template: 'order.created.admin',
            orderId: order.orderId,
            recipient: businessNumber,
            message: messageText,
            status,
            externalId: result.messageId || '',
            error: result.error || '',
        });

        if (!result.ok && !result.skipped) {
            logger.warn({ orderId: order.orderId, error: result.error }, 'Admin WhatsApp alert failed');
        }
    } catch (err) {
        logger.error({ err, orderId: order?.orderId }, 'notifyAdminNewOrder threw unexpectedly');
    }
};

// ── Customer confirmation on new order ───────────────────────────────────────
//
// Sends the orderTemplate to the customer's phone when an order is placed.
// Gate: features.whatsapp must be true AND whatsapp.notifyOnOrder must be true.
export const notifyCustomerOrderCreated = async (order) => {
    try {
        const enabled = await isFeatureEnabled('whatsapp', false);
        if (!enabled) return;

        const settings = await getSettings();
        if (!settings?.whatsapp?.notifyOnOrder) return;

        const template = settings?.whatsapp?.orderTemplate;
        if (!template) return;

        const result = await sendCustomerOrderConfirmation(order, template);

        // Build the interpolated message text for the log.
        const messageText = template
            .replace(/\{\{name\}\}/g, order.customerName || 'there')
            .replace(/\{\{orderId\}\}/g, order.orderId)
            .replace(/\{\{total\}\}/g, `${Number(order.totalAmount || 0).toFixed(0)} BDT`)
            .replace(/\{\{status\}\}/g, order.orderStatus || 'pending');

        const status = result.skipped ? 'skipped' : result.ok ? 'sent' : 'failed';

        await log({
            type: 'whatsapp',
            template: 'order.created.customer',
            orderId: order.orderId,
            recipient: order.customerPhone || '',
            message: messageText,
            status,
            externalId: result.messageId || '',
            error: result.error || '',
        });

        if (!result.ok && !result.skipped) {
            logger.warn({ orderId: order.orderId, error: result.error }, 'Customer order confirmation WhatsApp failed');
        }
    } catch (err) {
        logger.error({ err, orderId: order?.orderId }, 'notifyCustomerOrderCreated threw unexpectedly');
    }
};

// ── Customer alert on status change ──────────────────────────────────────────
//
// Sends the statusTemplate to the customer's phone when order status changes.
// Gate: features.whatsapp must be true AND whatsapp.notifyOnStatusChange must be true.
export const notifyCustomerStatusChange = async (order) => {
    try {
        const enabled = await isFeatureEnabled('whatsapp', false);
        if (!enabled) return;

        const settings = await getSettings();
        if (!settings?.whatsapp?.notifyOnStatusChange) return;

        const template = settings?.whatsapp?.statusTemplate;
        if (!template) return;

        const result = await sendCustomerStatusAlert(order, template);

        const messageText = template
            .replace(/\{\{name\}\}/g, order.customerName || 'there')
            .replace(/\{\{orderId\}\}/g, order.orderId)
            .replace(/\{\{total\}\}/g, `${Number(order.totalAmount || 0).toFixed(0)} BDT`)
            .replace(/\{\{status\}\}/g, order.orderStatus || '');

        const status = result.skipped ? 'skipped' : result.ok ? 'sent' : 'failed';

        await log({
            type: 'whatsapp',
            template: 'order.status.customer',
            orderId: order.orderId,
            recipient: order.customerPhone || '',
            message: messageText,
            status,
            externalId: result.messageId || '',
            error: result.error || '',
        });

        if (!result.ok && !result.skipped) {
            logger.warn({ orderId: order.orderId, error: result.error }, 'Customer status WhatsApp failed');
        }
    } catch (err) {
        logger.error({ err, orderId: order?.orderId }, 'notifyCustomerStatusChange threw unexpectedly');
    }
};
