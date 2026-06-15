import mongoose from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// ── NotificationLog ──────────────────────────────────────────────────────────
//
// Append-only log of every WhatsApp (and email, for future use) notification
// attempt. Merchants can view this from the admin panel to confirm that a
// customer actually received their message, and to diagnose delivery failures.
//
// Design decisions:
//   • Immutable after creation — notifications are events, not mutable state.
//   • TTL index auto-purges entries older than 90 days to bound collection size.
//   • tenantPlugin scopes every read/write to the requesting store (multi-tenant safe).
//   • `recipient` stores the phone/email — sensitive but necessary for audit.
//   • `error` is only populated on status:'failed'; helps merchants self-diagnose
//     (e.g. "WHATSAPP_TOKEN not configured" → they know to add the env var).

const notificationLogSchema = new mongoose.Schema(
    {
        // What channel sent this notification.
        type: {
            type: String,
            enum: ['whatsapp', 'email'],
            required: true,
            index: true,
        },

        // Which event triggered this notification.
        // e.g. 'order.created.customer', 'order.created.admin', 'order.status.customer'
        template: {
            type: String,
            required: true,
            trim: true,
        },

        // The order or resource this notification relates to.
        orderId: {
            type: String,
            default: '',
            index: true,
        },

        // The phone number (WhatsApp) or email address the notification was sent to.
        recipient: {
            type: String,
            required: true,
            trim: true,
        },

        // The full message body that was sent (or attempted). Stored so admins
        // can verify the exact text a customer received.
        message: {
            type: String,
            default: '',
        },

        // Delivery outcome.
        status: {
            type: String,
            enum: ['sent', 'failed', 'skipped'],
            required: true,
            index: true,
        },

        // WhatsApp Cloud API message ID on success; empty on failure/skip.
        externalId: {
            type: String,
            default: '',
        },

        // Error message when status is 'failed' or 'skipped'.
        error: {
            type: String,
            default: '',
        },

        // When the send was attempted (redundant with createdAt but explicit for
        // querying "show me everything sent in the last hour").
        sentAt: {
            type: Date,
            default: () => new Date(),
            index: true,
        },
    },
    {
        timestamps: true,
        // Compound index for the admin list view: tenant + time (newest first).
        // Queries like "show me the last 50 notifications for this store" hit this.
    },
);

// Compound indexes for common admin queries.
notificationLogSchema.index({ tenantId: 1, sentAt: -1 });
notificationLogSchema.index({ tenantId: 1, type: 1, sentAt: -1 });
notificationLogSchema.index({ tenantId: 1, orderId: 1, sentAt: -1 });

// Auto-purge: keep 90 days of history. Mongo TTL index fires on `sentAt`.
notificationLogSchema.index({ sentAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

notificationLogSchema.plugin(tenantPlugin);

const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
export default NotificationLog;
