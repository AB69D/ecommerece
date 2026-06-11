import mongoose from 'mongoose';

// ── Tenant (the registry; NOT tenant-owned — it IS the tenant) ──────────────
// One document per business on the platform. This is the spine of the SaaS:
// a request is resolved to exactly one Tenant (by subdomain), and every other
// collection is partitioned by this document's _id (the `tenantId`).
//
// NOTE the terminology: in older storefront code "client" means the end shopper
// (/api/client/*). Here a Tenant is a BUSINESS that signed up — never call it a
// "client". Tenant staff are Admins (tenant-scoped); shoppers are Customers.

// Lightweight billing state cached on the tenant so the admin-lock guard and the
// super-admin fleet view can read it without recomputing. The source of truth
// for sales is still the Order collection; these fields are a maintained cache
// (refreshed by the metering job / order hooks in Phase 4).
const billingStateSchema = new mongoose.Schema(
    {
        // Drives enforcement. 'active' = normal; 'past_due' = over limit / unpaid
        // (warned); 'locked' = admin panel is locked until they pay (storefront
        // keeps selling — the owner's chosen enforcement model).
        status: {
            type: String,
            enum: ['active', 'past_due', 'locked'],
            default: 'active',
            index: true,
        },
        // Cached gross sales for the current billing period (all orders, both
        // channels). Recomputed from Orders; do not treat as authoritative.
        currentPeriodSales: { type: Number, default: 0, min: 0 },
        // Amount the tenant currently owes the platform (subscription + overage).
        balanceDue: { type: Number, default: 0, min: 0 },
        lastInvoiceAt: { type: Date },
        lastPaidAt: { type: Date },
        // Human-readable reason shown to the tenant when admin is locked.
        lockedReason: { type: String, default: '' },
    },
    { _id: false },
);

const tenantSchema = new mongoose.Schema(
    {
        businessName: { type: String, required: true, trim: true },

        // acme.yourapp.com -> subdomain 'acme'. Globally unique, lowercase.
        subdomain: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 2,
            maxlength: 63,
            match: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, // DNS-label safe
        },
        // Optional vanity domain (Phase 5). Sparse so most tenants can omit it.
        customDomain: { type: String, trim: true, lowercase: true, sparse: true, unique: true },

        // Lifecycle: register -> pending -> approve -> approved (provisioned).
        // suspended = temporarily disabled; rejected = denied at review.
        status: {
            type: String,
            enum: ['pending', 'approved', 'suspended', 'rejected'],
            default: 'pending',
            index: true,
        },

        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan' },
        // The tenant's owner login (an Admin, tenant-scoped once Phase 1 lands).
        ownerAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        ownerEmail: { type: String, trim: true, lowercase: true },

        // Marks the original live business ("tenant zero"). Used by the Phase 1
        // data migration to know which tenant to back-fill existing rows onto.
        // Exactly one tenant should carry this.
        isPrimary: { type: Boolean, default: false },

        contact: {
            phone: { type: String, default: '', trim: true },
            address: { type: String, default: '', trim: true },
        },

        billing: { type: billingStateSchema, default: () => ({}) },

        // Super-admin internal notes (not shown to the tenant).
        notes: { type: String, default: '' },

        approvedAt: { type: Date },
        provisionedAt: { type: Date },
        suspendedAt: { type: Date },
    },
    { timestamps: true },
);

const TenantModel = mongoose.model('Tenant', tenantSchema);

export default TenantModel;
