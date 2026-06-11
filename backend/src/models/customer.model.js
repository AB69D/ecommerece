import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

// A saved delivery address. Mirrors the fields the storefront checkout already
// collects (shippingAddress + deliveryArea) so a saved address can prefill the
// form in one tap. Kept as a subdocument array on the customer.
const addressSchema = new mongoose.Schema(
    {
        label: { type: String, default: 'Home', trim: true, maxlength: 40 },
        fullName: { type: String, default: '', trim: true, maxlength: 120 },
        phone: { type: String, default: '', trim: true, maxlength: 40 },
        addressLine: { type: String, default: '', trim: true, maxlength: 500 },
        city: { type: String, default: '', trim: true, maxlength: 120 },
        // Matches the storefront delivery-area buckets used for delivery charge.
        area: {
            type: String,
            enum: ['local', 'regional', 'international'],
            default: 'local',
        },
        notes: { type: String, default: '', trim: true, maxlength: 500 },
        isDefault: { type: Boolean, default: false },
    },
    { _id: true, timestamps: false },
);

const customerSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 120 },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        phone: { type: String, default: '', trim: true, maxlength: 40 },
        // bcrypt hash; never returned by default queries (mirrors admin model).
        passwordHash: { type: String, required: true, select: false },
        // Stable storefront identity. The customer's cart and wishlist are keyed
        // by this id, reusing the existing anonymous `guest-id` machinery — so
        // signing in on any device restores the same cart/wishlist with no
        // schema migration. Generated once at registration and never changes.
        guestId: {
            type: String,
            required: true,
            index: true,
            default: () => `cust_${randomUUID()}`,
        },
        addresses: { type: [addressSchema], default: [] },
        isActive: { type: Boolean, default: true },
        lastLoginAt: { type: Date },
        // Forgot-password flow. We persist only the SHA-256 hash of the one-time
        // reset token — the raw token lives solely in the emailed link — so a
        // database read can never be turned into an account takeover. Both are
        // select:false (never serialised to the client) and cleared on use.
        resetTokenHash: { type: String, select: false },
        resetTokenExpiresAt: { type: Date, select: false },
    },
    { timestamps: true },
);

// Look up a password-reset request by its token hash in one indexed hit. Sparse
// so it only indexes the handful of accounts with a reset in flight (the field
// is unset the moment a token is used or a new password is set).
customerSchema.index({ resetTokenHash: 1 }, { sparse: true });

customerSchema.plugin(tenantPlugin);

// Login email + storefront identity are unique PER TENANT (were global-unique).
customerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
customerSchema.index({ tenantId: 1, guestId: 1 }, { unique: true });

const CustomerModel = mongoose.model('Customer', customerSchema);

export default CustomerModel;
