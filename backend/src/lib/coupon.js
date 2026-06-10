// Pure, side-effect-free coupon math + eligibility checks. Shared by the
// storefront checkout, the POS terminal, and the admin "validate" preview so
// the discount is computed identically everywhere (single source of truth).

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Discount amount a coupon yields for a given subtotal (never exceeds it).
export const computeCouponDiscount = (coupon, subtotal) => {
    const sub = Number(subtotal) || 0;
    if (!coupon || sub <= 0) return 0;
    let discount = 0;
    if (coupon.type === 'fixed') {
        discount = Number(coupon.value) || 0;
    } else {
        // percent
        discount = (sub * (Number(coupon.value) || 0)) / 100;
        const cap = Number(coupon.maxDiscount) || 0;
        if (cap > 0) discount = Math.min(discount, cap);
    }
    return round2(Math.max(0, Math.min(discount, sub)));
};

// Returns { ok, reason } describing whether a coupon can be redeemed right now
// for the given subtotal + channel. `now` is injectable for testing.
export const checkCouponEligibility = (coupon, { subtotal = 0, channel = 'ecommerce', now = new Date() } = {}) => {
    if (!coupon) return { ok: false, reason: 'Coupon not found' };
    if (!coupon.active) return { ok: false, reason: 'This coupon is no longer active' };

    if (Array.isArray(coupon.channels) && coupon.channels.length > 0 && !coupon.channels.includes(channel)) {
        return { ok: false, reason: 'This coupon is not valid for this channel' };
    }

    const t = now instanceof Date ? now : new Date(now);
    if (coupon.startsAt && t < new Date(coupon.startsAt)) {
        return { ok: false, reason: 'This coupon is not active yet' };
    }
    if (coupon.expiresAt && t > new Date(coupon.expiresAt)) {
        return { ok: false, reason: 'This coupon has expired' };
    }

    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        return { ok: false, reason: 'This coupon has reached its usage limit' };
    }

    const sub = Number(subtotal) || 0;
    if (coupon.minSubtotal > 0 && sub < coupon.minSubtotal) {
        return { ok: false, reason: `Spend at least ${coupon.minSubtotal} to use this coupon` };
    }

    return { ok: true, reason: '' };
};

// Convenience: eligibility + computed discount in one call.
export const evaluateCoupon = (coupon, opts = {}) => {
    const eligibility = checkCouponEligibility(coupon, opts);
    if (!eligibility.ok) return { ...eligibility, discount: 0 };
    return { ok: true, reason: '', discount: computeCouponDiscount(coupon, opts.subtotal) };
};
