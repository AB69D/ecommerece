import mongoose from 'mongoose';

// ── Plan (platform-level; NOT tenant-owned) ─────────────────────────────────
// A subscription plan offered to tenants (businesses) on the platform. The
// platform owner (super-admin) creates and edits these. A plan defines THREE
// things:
//   1. the recurring fee a tenant pays to run their store (`price`),
//   2. a monthly SALES LIMIT (the "sell more than 50,000" threshold) which is
//      fully configurable per plan — set 0 for "unlimited",
//   3. how the OVERAGE (the extra a tenant owes once they pass the limit) is
//      calculated — also fully configurable, because the platform owner asked
//      to be able to tune the billing rule themselves.
//
// Nothing here is hardcoded: the owner picks the limit, the overage mode, and
// the rate/fee from the super-admin panel (Phase 4 surfaces the UI).

const overageSchema = new mongoose.Schema(
    {
        // How the extra charge is computed once monthly sales pass `salesLimit`:
        //   'none'       — no overage; the limit is a soft cap (or unlimited).
        //   'percent'    — charge `percent`% of the sales ABOVE the limit
        //                  (e.g. 2% of every taka over 50,000). Scales with size.
        //   'flat_block' — charge `blockFee` for each `blockSize` of sales above
        //                  the limit (e.g. +500 per extra 50,000). Predictable.
        mode: {
            type: String,
            enum: ['none', 'percent', 'flat_block'],
            default: 'percent',
        },
        // Used when mode === 'percent'. Percentage of the excess (2 = 2%).
        percent: { type: Number, default: 0, min: 0 },
        // Used when mode === 'flat_block'. Size of each charged block of sales.
        blockSize: { type: Number, default: 0, min: 0 },
        // Used when mode === 'flat_block'. Fee charged per block.
        blockFee: { type: Number, default: 0, min: 0 },
    },
    { _id: false },
);

// Per-plan resource caps. 0 means "unlimited" for that resource so a plan can
// leave any limit open. Enforced at create-time by plan-limit middleware (Phase
// 4); stored here so caps are data-driven, not hardcoded.
const limitsSchema = new mongoose.Schema(
    {
        maxProducts: { type: Number, default: 0, min: 0 },
        maxStaff: { type: Number, default: 0, min: 0 },
        maxCategories: { type: Number, default: 0, min: 0 },
        // Soft analytics cap; not enforced as a hard block by default.
        maxOrdersPerMonth: { type: Number, default: 0, min: 0 },
    },
    { _id: false },
);

const planSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        // Stable machine identifier used in code / URLs (e.g. 'starter').
        slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
        description: { type: String, default: '', trim: true },

        // Recurring subscription fee the tenant pays the platform.
        price: { type: Number, default: 0, min: 0 },
        billingInterval: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
        // Currency the platform bills tenants in (separate from each tenant's own
        // storefront currency). Defaults to BDT to match the SSLCommerz setup.
        currency: { type: String, default: 'BDT', uppercase: true, trim: true },

        // The DYNAMIC monthly sales threshold. 0 = unlimited (no overage).
        salesLimit: { type: Number, default: 0, min: 0 },

        overage: { type: overageSchema, default: () => ({}) },
        limits: { type: limitsSchema, default: () => ({}) },

        // Feature keys this plan unlocks (mirrors siteSettings.features keys, e.g.
        // 'coupons', 'posShift', 'analytics'). Empty = use platform defaults.
        features: { type: [String], default: [] },

        // Whether new tenants may be assigned this plan.
        isActive: { type: Boolean, default: true },
        // Whether to show it on a public pricing page (Phase 4+).
        isPublic: { type: Boolean, default: true },
        // Display ordering on pricing tables.
        sortOrder: { type: Number, default: 0 },
    },
    { timestamps: true },
);

const PlanModel = mongoose.model('Plan', planSchema);

export default PlanModel;
