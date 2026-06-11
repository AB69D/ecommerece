import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import TenantModel from '../models/tenant.model.js';
import AdminModel from '../models/admin.model.js';
import { runAsTenant } from '../tenancy/tenantContext.js';
import { provisionTenant } from '../tenancy/provisionTenant.js';
import { sendEmail } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';
import { env } from '../config/env.js';

// ── Platform (super-admin) controller ───────────────────────────────────────
// Tenant onboarding + fleet management. Every handler here runs in a SYSTEM
// (cross-tenant) context — the route group is mounted that way — so reads/writes
// against tenant-owned collections are NOT auto-scoped to one tenant. Tenant
// creation/activation is therefore done explicitly per tenant where needed.
//
// Lifecycle: register -> pending -> (super-admin) approve -> approved+provisioned
//            (or reject); approved -> suspend/resume.

const ok = (res, message, data) => res.json({ success: true, error: false, message, data });
const fail = (res, code, message) => res.status(code).json({ success: false, error: true, message });

// Labels that can never be a tenant subdomain (infra, platform, and the primary
// store's own subdomain). Kept broad on purpose — easier to free one later than
// to claw back a subdomain someone already trusted.
const RESERVED_SUBDOMAINS = new Set([
    'www', 'api', 'cdn', 'assets', 'static', 'mail', 'admin', 'app', 'platform',
    'super', 'superadmin', 'root', 'system', 'dashboard', 'account', 'login',
    'register', 'signup', 'help', 'support', 'status', 'docs', 'blog',
    String(env.TENANT_ZERO_SUBDOMAIN || '').toLowerCase(),
]);

const SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/; // DNS-label safe
const USERNAME_RE = /^[a-z0-9._-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// POST /api/platform/register  (PUBLIC)
// Body: { businessName, subdomain, owner:{ fullName, email, username, password },
//         contact:{ phone, address } }
// Creates a pending tenant + its (inactive) owner super-admin. No access is
// granted until a platform super-admin approves.
// ---------------------------------------------------------------------------
export const registerStore = async (req, res) => {
    try {
        const body = req.body || {};
        const owner = body.owner || {};
        const contact = body.contact || {};

        const businessName = String(body.businessName || '').trim();
        const subdomain = String(body.subdomain || '').trim().toLowerCase();
        const fullName = String(owner.fullName || '').trim();
        const email = String(owner.email || '').trim().toLowerCase();
        const username = String(owner.username || '').trim().toLowerCase();
        const password = String(owner.password || '');

        // ── Validate ────────────────────────────────────────────────────────
        if (!businessName || businessName.length < 2 || businessName.length > 100) {
            return fail(res, 400, 'Business name must be 2–100 characters.');
        }
        if (!subdomain || subdomain.length < 2 || subdomain.length > 63 || !SUBDOMAIN_RE.test(subdomain)) {
            return fail(res, 400, 'Subdomain must be 2–63 chars: letters, numbers and hyphens only.');
        }
        if (RESERVED_SUBDOMAINS.has(subdomain)) {
            return fail(res, 400, `"${subdomain}" is reserved. Please choose another.`);
        }
        if (!email || !EMAIL_RE.test(email)) {
            return fail(res, 400, 'A valid owner email is required.');
        }
        if (!username || username.length < 3 || username.length > 64 || !USERNAME_RE.test(username)) {
            return fail(res, 400, 'Username must be 3–64 chars: letters, numbers, dot, underscore or hyphen.');
        }
        if (!password || password.length < 8) {
            return fail(res, 400, 'Password must be at least 8 characters.');
        }

        // Availability (the unique index is the real backstop against races).
        const taken = await TenantModel.findOne({ subdomain }).select('_id').lean();
        if (taken) return fail(res, 409, `Subdomain "${subdomain}" is already taken.`);

        // ── Create tenant (pending) ──────────────────────────────────────────
        const tenant = await TenantModel.create({
            businessName,
            subdomain,
            status: 'pending',
            ownerEmail: email,
            contact: { phone: String(contact.phone || '').trim(), address: String(contact.address || '').trim() },
        });

        // ── Create the owner super-admin UNDER the new tenant (inactive) ──────
        // Wrapped in the tenant context so the scoping plugin stamps tenantId.
        // Roll the tenant back if this fails (no multi-doc txn on standalone Mongo).
        let admin;
        try {
            const passwordHash = await bcrypt.hash(password, 10);
            await runAsTenant(tenant._id, async () => {
                admin = await AdminModel.create({
                    username,
                    email,
                    fullName,
                    role: 'super-admin', // owner of THEIR store (not the platform)
                    isActive: false, // activated on approval
                    passwordHash,
                    addedBy: 'self-signup',
                });
            });
        } catch (e) {
            await TenantModel.deleteOne({ _id: tenant._id });
            if (e?.code === 11000) return fail(res, 409, 'That username or email is already in use.');
            throw e;
        }

        tenant.ownerAdminId = admin._id;
        await tenant.save();

        // ── Notify (best-effort; never blocks the signup) ────────────────────
        notifyRegistration({ businessName, subdomain, email }).catch((err) =>
            logger.warn({ err }, 'platform.register: notification failed'),
        );

        logger.info({ tenantId: String(tenant._id), subdomain }, 'platform.register: new store pending');
        return ok(res, 'Registration received. Your store is pending approval — we will email you once it is live.', {
            tenantId: tenant._id,
            subdomain,
            status: tenant.status,
        });
    } catch (err) {
        logger.error({ err }, 'platform.register failed');
        return fail(res, 500, err.message || 'Registration failed');
    }
};

// ---------------------------------------------------------------------------
// GET /api/platform/tenants?status=pending   (super-admin)
// ---------------------------------------------------------------------------
export const listTenants = async (req, res) => {
    try {
        const filter = {};
        const status = String(req.query.status || '').trim();
        if (['pending', 'approved', 'suspended', 'rejected'].includes(status)) filter.status = status;

        const tenants = await TenantModel.find(filter)
            .select('businessName subdomain status isPrimary ownerEmail planId billing approvedAt provisionedAt suspendedAt createdAt')
            .sort({ createdAt: -1 })
            .lean();

        return ok(res, 'Tenants', { tenants, count: tenants.length });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to list tenants');
    }
};

// ---------------------------------------------------------------------------
// GET /api/platform/tenants/:id   (super-admin)
// ---------------------------------------------------------------------------
export const getTenant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid tenant id');

        const tenant = await TenantModel.findById(id).lean();
        if (!tenant) return fail(res, 404, 'Tenant not found');

        // System context => this read is cross-tenant (not scoped to the tenant).
        let owner = null;
        if (tenant.ownerAdminId) {
            owner = await AdminModel.findById(tenant.ownerAdminId)
                .select('username email fullName role isActive lastLoginAt createdAt')
                .lean();
        }

        return ok(res, 'Tenant', { tenant, owner });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to load tenant');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/tenants/:id/approve   (super-admin)
// Approve -> activate owner login -> provision (subscription + provisionedAt).
// ---------------------------------------------------------------------------
export const approveTenant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid tenant id');

        const tenant = await TenantModel.findById(id);
        if (!tenant) return fail(res, 404, 'Tenant not found');
        if (tenant.status === 'approved') return ok(res, 'Tenant is already approved.', { tenant });
        if (tenant.status === 'rejected') return fail(res, 409, 'Rejected tenants cannot be approved; ask them to re-register.');

        tenant.status = 'approved';
        tenant.approvedAt = new Date();
        tenant.suspendedAt = undefined;
        if (tenant.billing) tenant.billing.status = 'active';

        // Activate the owner login (cross-tenant write is fine in system context).
        if (tenant.ownerAdminId) {
            await AdminModel.updateOne({ _id: tenant.ownerAdminId }, { $set: { isActive: true } });
        }

        await provisionTenant(tenant); // saves the tenant (subscription + provisionedAt)

        notifyApproval({ businessName: tenant.businessName, subdomain: tenant.subdomain, email: tenant.ownerEmail }).catch(
            (err) => logger.warn({ err }, 'platform.approve: notification failed'),
        );

        logger.info({ tenantId: String(tenant._id), subdomain: tenant.subdomain }, 'platform.approve: store live');
        return ok(res, `Approved. "${tenant.businessName}" is now live.`, { tenant });
    } catch (err) {
        logger.error({ err }, 'platform.approve failed');
        return fail(res, 500, err.message || 'Approval failed');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/tenants/:id/suspend   (super-admin)  body: { reason? }
// POST /api/platform/tenants/:id/reject    (super-admin)  body: { reason? }
// ---------------------------------------------------------------------------
export const suspendTenant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid tenant id');

        const tenant = await TenantModel.findById(id);
        if (!tenant) return fail(res, 404, 'Tenant not found');
        if (tenant.isPrimary) return fail(res, 403, 'The primary store cannot be suspended.');

        // Toggle: suspend an approved store, or resume a suspended one.
        if (tenant.status === 'suspended') {
            tenant.status = 'approved';
            tenant.suspendedAt = undefined;
            if (tenant.billing) tenant.billing.status = 'active';
            await tenant.save();
            return ok(res, `Resumed "${tenant.businessName}".`, { tenant });
        }

        tenant.status = 'suspended';
        tenant.suspendedAt = new Date();
        if (req.body?.reason) tenant.notes = String(req.body.reason).slice(0, 1000);
        await tenant.save();
        logger.info({ tenantId: String(tenant._id) }, 'platform.suspend');
        return ok(res, `Suspended "${tenant.businessName}".`, { tenant });
    } catch (err) {
        return fail(res, 500, err.message || 'Suspend failed');
    }
};

export const rejectTenant = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid tenant id');

        const tenant = await TenantModel.findById(id);
        if (!tenant) return fail(res, 404, 'Tenant not found');
        if (tenant.isPrimary) return fail(res, 403, 'The primary store cannot be rejected.');
        if (tenant.status === 'approved') return fail(res, 409, 'Approved stores cannot be rejected; suspend instead.');

        tenant.status = 'rejected';
        if (req.body?.reason) tenant.notes = String(req.body.reason).slice(0, 1000);
        await tenant.save();

        // Keep the (inactive) owner login disabled.
        if (tenant.ownerAdminId) {
            await AdminModel.updateOne({ _id: tenant.ownerAdminId }, { $set: { isActive: false } });
        }
        logger.info({ tenantId: String(tenant._id) }, 'platform.reject');
        return ok(res, `Rejected "${tenant.businessName}".`, { tenant });
    } catch (err) {
        return fail(res, 500, err.message || 'Reject failed');
    }
};

// ── Email helpers (best-effort) ─────────────────────────────────────────────
async function notifyRegistration({ businessName, subdomain, email }) {
    // Confirm to the applicant.
    await sendEmail({
        to: email,
        subject: 'We received your store registration',
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#1a1a1a;">Registration received</h2>
            <p style="color:#555;line-height:1.6;">Thanks for registering <strong>${businessName}</strong>
            (<code>${subdomain}</code>). Your store is <strong>pending approval</strong>.
            We'll email you as soon as it's live and you can log in.</p>
        </div>`,
    });
    // Notify the platform owner(s).
    const owners = env.ADMIN_EMAILS || [];
    if (owners.length) {
        await sendEmail({
            to: owners.join(','),
            subject: `New store signup: ${businessName} (${subdomain})`,
            html: `<div style="font-family:Arial,sans-serif;">
                <p>A new store has registered and is awaiting approval:</p>
                <ul>
                    <li><strong>Business:</strong> ${businessName}</li>
                    <li><strong>Subdomain:</strong> ${subdomain}</li>
                    <li><strong>Owner:</strong> ${email}</li>
                </ul>
                <p>Review it in the super-admin dashboard.</p>
            </div>`,
        });
    }
}

async function notifyApproval({ businessName, subdomain, email }) {
    if (!email) return;
    await sendEmail({
        to: email,
        subject: `Your store "${businessName}" is live`,
        html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
            <h2 style="color:#1a1a1a;">You're approved 🎉</h2>
            <p style="color:#555;line-height:1.6;"><strong>${businessName}</strong> (<code>${subdomain}</code>)
            is now live. Log in to your admin panel to set up your business details, products and storefront.</p>
        </div>`,
    });
}
