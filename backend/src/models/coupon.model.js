import { Schema, model } from 'mongoose';

// Cart-level discount codes (distinct from per-product `discountPercent`).
// A coupon applies to the order subtotal at storefront checkout and/or the
// in-store POS terminal, gated by validity window, usage caps, and channel.
const couponSchema = new Schema(
    {
        // Stored uppercase + trimmed so lookups are case-insensitive.
        code: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
            index: true,
        },
        description: { type: String, default: '' },

        // 'percent' -> `value` is 0–100, 'fixed' -> `value` is an absolute amount.
        type: { type: String, enum: ['percent', 'fixed'], default: 'percent' },
        value: { type: Number, required: true, min: 0 },

        // Minimum order subtotal required to redeem (0 = no minimum).
        minSubtotal: { type: Number, default: 0, min: 0 },
        // Cap for percent coupons (0 = uncapped). Ignored for fixed coupons.
        maxDiscount: { type: Number, default: 0, min: 0 },

        // Validity window (null = open-ended on that side).
        startsAt: { type: Date, default: null },
        expiresAt: { type: Date, default: null },

        // Redemption caps. 0 = unlimited.
        usageLimit: { type: Number, default: 0, min: 0 },
        usedCount: { type: Number, default: 0, min: 0 },

        // Where the coupon may be used. Defaults to both channels.
        channels: {
            type: [{ type: String, enum: ['ecommerce', 'pos'] }],
            default: ['ecommerce', 'pos'],
        },

        active: { type: Boolean, default: true },
    },
    { timestamps: true },
);

const CouponModel = model('Coupon', couponSchema);

export default CouponModel;
