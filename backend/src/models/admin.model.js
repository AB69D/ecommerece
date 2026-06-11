import mongoose from "mongoose";
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            minlength: 3,
            maxlength: 64,
            match: /^[a-z0-9._-]+$/,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false, // never returned by default queries
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            default: "",
            trim: true,
        },
        role: {
            type: String,
            enum: ["super-admin", "admin", "moderator", "salesman"],
            default: "admin",
            index: true,
        },
        // Extra permission grants on top of the role defaults.
        // Each entry is a "resource:action" string (see lib/permissions.js).
        permissions: {
            type: [String],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: {
            type: Date,
        },
        addedBy: {
            type: String,
            default: "system",
        },
    },
    { timestamps: true },
);

adminSchema.plugin(tenantPlugin);

// Auth identifiers are GLOBAL-unique (across every tenant). On the shared domain
// there is no subdomain to identify the store before login, so a store owner is
// found by username alone — which therefore must be unique across all stores.
// (Subdomains come later; until then the username IS the cross-store identity.)
// email keeps a partial filter so an admin MAY omit an email, while any email
// that IS set stays unique platform-wide. tenantId still carries its own
// (non-unique) index from the plugin for scoped reads.
adminSchema.index({ username: 1 }, { unique: true });
adminSchema.index(
    { email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

const AdminModel = mongoose.model("Admin", adminSchema);

export default AdminModel;
