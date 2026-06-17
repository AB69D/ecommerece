import mongoose from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// ── COD OTP Verification ────────────────────────────────────────────────────
// One OTP document per order. Created immediately after an order is saved when
// the `features.codOtpVerification` flag is on and the payment method is
// `cash_on_delivery`. The customer must submit the correct 6-digit code within
// 24 hours; if they fail 3 consecutive times the order is cancelled.
//
// The TTL index (expiresAt) lets MongoDB auto-delete stale docs so the
// collection never grows unbounded.

const orderOtpSchema = new mongoose.Schema(
    {
        orderId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Order' },
        // The human-readable order ID (e.g. "GG-ABC123") — stored so the verify
        // endpoint can look up by orderId string without a separate order fetch.
        orderRef: { type: String, required: true },
        phone: { type: String, required: true, trim: true },
        code: { type: String, required: true },                 // 6-digit string
        attempts: { type: Number, default: 0 },                // incremented on wrong code
        verified: { type: Boolean, default: false },
        voided: { type: Boolean, default: false },              // true after 3 failed attempts
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true },
);

// Auto-delete documents after their expiry — no manual cron needed.
orderOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Primary lookup: find the active OTP for an order.
orderOtpSchema.index({ tenantId: 1, orderId: 1 });

// Rate-limit lookup: count recent OTPs sent to this phone number.
orderOtpSchema.index({ tenantId: 1, phone: 1, createdAt: -1 });

orderOtpSchema.plugin(tenantPlugin);

export default mongoose.model('OrderOtp', orderOtpSchema);
