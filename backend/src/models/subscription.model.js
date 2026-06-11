import mongoose from 'mongoose';

// ── Subscription (platform-managed; carries tenantId as a plain field) ──────
// Links one Tenant to the Plan it is on, and tracks the current billing period
// and platform payment state. This is managed by the PLATFORM (super-admin) in
// system context, so it deliberately does NOT use the tenant scoping plugin —
// it carries `tenantId` only as a foreign key for lookups, not for auto-scoping.
//
// Per-period usage/overage invoices are computed against the Order collection
// (the source of truth for sales) and surfaced in Phase 4.

const subscriptionSchema = new mongoose.Schema(
    {
        // No field-level `index: true` here: the explicit unique index below
        // (one subscription per tenant) already covers { tenantId: 1 } lookups.
        // Declaring both would emit a "Duplicate schema index" warning.
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
        },
        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },

        // 'trialing' before first payment; 'active' once paying; 'past_due' when
        // an invoice is unpaid; 'canceled' when the tenant leaves.
        status: {
            type: String,
            enum: ['trialing', 'active', 'past_due', 'canceled'],
            default: 'active',
            index: true,
        },
        interval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },

        // Current billing window. Sales are metered between these two dates.
        currentPeriodStart: { type: Date, default: Date.now },
        currentPeriodEnd: { type: Date },
        cancelAtPeriodEnd: { type: Boolean, default: false },

        // Platform-side payment bookkeeping (tenant pays the PLATFORM via the
        // platform's own SSLCommerz account — distinct from each tenant's own
        // gateway for their customers' money, which arrives in Phase 5).
        lastPaymentAt: { type: Date },
        lastPaymentTranId: { type: String, default: '' },
        canceledAt: { type: Date },
    },
    { timestamps: true },
);

// A tenant has at most one subscription record.
subscriptionSchema.index({ tenantId: 1 }, { unique: true });

const SubscriptionModel = mongoose.model('Subscription', subscriptionSchema);

export default SubscriptionModel;
