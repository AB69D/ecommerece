import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import TenantModel from '../models/tenant.model.js';
import AdminModel from '../models/admin.model.js';
import OrderModel from '../models/order.model.js';
import { runAsTenant, runAsSystem } from '../tenancy/tenantContext.js';
import { provisionTenant } from '../tenancy/provisionTenant.js';
import { clearTenantCache } from '../tenancy/resolveTenant.js';
import { isPlatformEmail } from '../middlewares/platformAuth.middleware.js';
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

        // Owner credentials are GLOBAL-unique across every store (the shared
        // domain identifies an owner by username alone — see admin.model.js).
        // This handler runs in system context, so this find is cross-tenant; the
        // global unique index is the race backstop, this is the friendly message.
        const dupe = await AdminModel.findOne({ $or: [{ username }, { email }] })
            .select('username email')
            .lean();
        if (dupe) {
            const which = dupe.username === username ? 'username' : 'email';
            return fail(res, 409, `That ${which} is already in use. Please choose another.`);
        }

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
// GET /api/platform/tenants/:id/users   (super-admin)
// Every staff account (owner, admins, moderators, POS sellers) belonging to a
// store — so the platform owner can maintain a store's users without having to
// impersonate. Password reset / activate-deactivate use the shared
// /admins/:id/* endpoints.
// ---------------------------------------------------------------------------
export const getTenantUsers = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid tenant id');

        const tenant = await TenantModel.findById(id).select('businessName subdomain ownerAdminId').lean();
        if (!tenant) return fail(res, 404, 'Tenant not found');

        // Platform routes run in system context, so this explicit tenantId filter
        // (cast from the route param) returns exactly that store's staff.
        const users = await runAsSystem(() =>
            AdminModel.find({ tenantId: id })
                .select('username email fullName role isActive isPlatformOwner lastLoginAt createdAt')
                .sort({ createdAt: 1 })
                .lean()
                .exec(),
        );

        const ownerId = tenant.ownerAdminId ? String(tenant.ownerAdminId) : null;
        const rows = users.map((u) => ({
            id: u._id,
            username: u.username,
            email: u.email || null,
            fullName: u.fullName || '',
            role: u.role,
            isActive: u.isActive !== false,
            isPlatformOwner: !!u.isPlatformOwner,
            isOwner: ownerId === String(u._id),
            lastLoginAt: u.lastLoginAt || null,
        }));

        return ok(res, 'Tenant users', {
            tenant: { id: tenant._id, businessName: tenant.businessName, subdomain: tenant.subdomain },
            users: rows,
            count: rows.length,
        });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to load store users');
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

        // Status changed — drop the tenant resolver's cached entry so the
        // storefront goes live immediately (otherwise it 404s for up to the 60s
        // cache TTL after approval).
        clearTenantCache();

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
            clearTenantCache(); // resume -> storefront live again now
            return ok(res, `Resumed "${tenant.businessName}".`, { tenant });
        }

        tenant.status = 'suspended';
        tenant.suspendedAt = new Date();
        if (req.body?.reason) tenant.notes = String(req.body.reason).slice(0, 1000);
        await tenant.save();
        clearTenantCache(); // suspend -> storefront blocked now
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
        clearTenantCache(); // status changed -> drop resolver cache

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

// ---------------------------------------------------------------------------
// GET /api/platform/overview   — the platform owner's home dashboard.
// Every store with its owner, order count and revenue (orders aggregated across
// all tenants in one pass), plus platform-wide totals.
// ---------------------------------------------------------------------------
export const getOverview = async (req, res) => {
    try {
        const tenants = await TenantModel.find({})
            .select('businessName subdomain status isPrimary ownerAdminId ownerEmail billing createdAt')
            .sort({ createdAt: -1 })
            .lean();

        // Orders are tenant-owned; group by tenantId in a single cross-tenant pass.
        // Cancelled/returned orders count toward the order tally but not revenue.
        const agg = await runAsSystem(() =>
            OrderModel.aggregate([
                {
                    $group: {
                        _id: '$tenantId',
                        orders: { $sum: 1 },
                        revenue: {
                            $sum: {
                                $cond: [
                                    { $in: ['$orderStatus', ['cancelled', 'returned']] },
                                    0,
                                    { $ifNull: ['$totalAmount', 0] },
                                ],
                            },
                        },
                    },
                },
            ]).exec(),
        );
        const statsById = new Map(agg.map((a) => [String(a._id), a]));

        const ownerIds = tenants.map((t) => t.ownerAdminId).filter(Boolean);
        const admins = ownerIds.length
            ? await runAsSystem(() =>
                  AdminModel.find({ _id: { $in: ownerIds } })
                      .select('username email isActive lastLoginAt')
                      .lean()
                      .exec(),
              )
            : [];
        const ownerById = new Map(admins.map((a) => [String(a._id), a]));

        let totalOrders = 0;
        let totalRevenue = 0;
        const stores = tenants.map((t) => {
            const s = statsById.get(String(t._id)) || { orders: 0, revenue: 0 };
            totalOrders += s.orders;
            totalRevenue += s.revenue;
            const a = t.ownerAdminId ? ownerById.get(String(t.ownerAdminId)) : null;
            return {
                tenantId: t._id,
                businessName: t.businessName,
                subdomain: t.subdomain,
                status: t.status,
                isPrimary: !!t.isPrimary,
                orders: s.orders,
                revenue: Math.round((s.revenue + Number.EPSILON) * 100) / 100,
                billingStatus: t.billing?.status || 'active',
                owner: a
                    ? { id: a._id, username: a.username, email: a.email || t.ownerEmail || null, isActive: a.isActive !== false, lastLoginAt: a.lastLoginAt || null }
                    : (t.ownerEmail ? { id: null, username: null, email: t.ownerEmail, isActive: false, lastLoginAt: null } : null),
            };
        });

        const activeStores = tenants.filter((t) => t.status === 'approved').length;
        const pendingStores = tenants.filter((t) => t.status === 'pending').length;

        return ok(res, 'Overview', {
            stores,
            totals: {
                stores: tenants.length,
                activeStores,
                pendingStores,
                orders: totalOrders,
                revenue: Math.round((totalRevenue + Number.EPSILON) * 100) / 100,
            },
        });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to load overview');
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// OWNER MANAGEMENT (super-admin)
// Two surfaces: PLATFORM owners (cross-tenant super-admins who run the fleet)
// and STORE owners (the per-store owner account of each tenant). All handlers
// run in the system context so cross-tenant reads/writes are intentional.
// ═══════════════════════════════════════════════════════════════════════════

// Mark the row that belongs to the caller so the UI can hide self-destructive
// actions (you can't revoke or deactivate yourself).
const isSelf = (me, admin) =>
    (!!me?.id && String(me.id) === String(admin._id)) ||
    (!!me?.email && !!admin?.email && me.email === String(admin.email).toLowerCase());

// ---------------------------------------------------------------------------
// GET /api/platform/owners   — list platform owners (DB-flagged + env bootstrap)
// ---------------------------------------------------------------------------
export const listOwners = async (req, res) => {
    try {
        const me = req.platformAdmin || {};
        const envEmails = env.ADMIN_EMAILS || [];

        const [dbOwners, envAdmins] = await Promise.all([
            runAsSystem(() =>
                AdminModel.find({ isPlatformOwner: true })
                    .select('username email fullName isActive lastLoginAt createdAt')
                    .sort({ createdAt: 1 })
                    .lean()
                    .exec(),
            ),
            envEmails.length
                ? runAsSystem(() =>
                      AdminModel.find({ email: { $in: envEmails } })
                          .select('username email fullName isActive lastLoginAt createdAt')
                          .lean()
                          .exec(),
                  )
                : [],
        ]);

        const byId = new Map();
        const add = (a) => {
            const key = String(a._id);
            const env_ = isPlatformEmail(a.email);
            const existing = byId.get(key);
            if (existing) { existing.isEnv = existing.isEnv || env_; return; }
            byId.set(key, {
                id: a._id,
                username: a.username,
                email: a.email || null,
                fullName: a.fullName || '',
                isActive: a.isActive !== false,
                lastLoginAt: a.lastLoginAt || null,
                createdAt: a.createdAt || null,
                isEnv: env_,            // granted via env → cannot be revoked here
                source: 'db',
                isSelf: isSelf(me, a),
            });
        };
        dbOwners.forEach(add);
        envAdmins.forEach(add);

        // Env emails with NO admin record yet (pure bootstrap identities).
        const seen = new Set([...byId.values()].map((o) => String(o.email || '').toLowerCase()));
        envEmails.forEach((em) => {
            if (seen.has(em)) return;
            byId.set(`env:${em}`, {
                id: null, username: null, email: em, fullName: '',
                isActive: true, lastLoginAt: null, createdAt: null,
                isEnv: true, source: 'env', isSelf: me.email === em,
            });
        });

        const owners = [...byId.values()];
        return ok(res, 'Platform owners', { owners, count: owners.length });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to list owners');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/owners   — create a NEW dedicated platform owner
// Body: { username, email, password, fullName? }
// The account lives on the primary store (its "home" tenant) and carries the
// cross-tenant isPlatformOwner flag.
// ---------------------------------------------------------------------------
export const createOwner = async (req, res) => {
    try {
        const b = req.body || {};
        const username = String(b.username || '').trim().toLowerCase();
        const email = String(b.email || '').trim().toLowerCase();
        const fullName = String(b.fullName || '').trim();
        const password = String(b.password || '');

        if (!username || username.length < 3 || username.length > 64 || !USERNAME_RE.test(username)) {
            return fail(res, 400, 'Username must be 3–64 chars: letters, numbers, dot, underscore or hyphen.');
        }
        if (!email || !EMAIL_RE.test(email)) return fail(res, 400, 'A valid email is required.');
        if (!password || password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.');

        // Auth identifiers are global-unique across every store.
        const dupe = await runAsSystem(() =>
            AdminModel.findOne({ $or: [{ username }, { email }] }).select('username email').lean().exec(),
        );
        if (dupe) {
            const which = dupe.username === username ? 'username' : 'email';
            return fail(res, 409, `That ${which} is already in use. Please choose another.`);
        }

        const primary = await TenantModel.findOne({ isPrimary: true }).select('_id').lean();
        if (!primary) return fail(res, 500, 'No primary store is configured to host the owner account.');

        const passwordHash = await bcrypt.hash(password, 10);
        let admin;
        try {
            await runAsTenant(primary._id, async () => {
                admin = await AdminModel.create({
                    username,
                    email,
                    fullName,
                    role: 'super-admin',
                    isActive: true,
                    isPlatformOwner: true,
                    passwordHash,
                    addedBy: req.platformAdmin?.email || 'platform',
                });
            });
        } catch (e) {
            if (e?.code === 11000) return fail(res, 409, 'That username or email is already in use.');
            throw e;
        }

        logger.info({ id: String(admin._id), username }, 'platform.createOwner');
        return ok(res, `Platform owner "${username}" created.`, {
            owner: {
                id: admin._id, username: admin.username, email: admin.email,
                fullName: admin.fullName, isActive: true, isPlatformOwner: true,
            },
        });
    } catch (err) {
        logger.error({ err }, 'platform.createOwner failed');
        return fail(res, 500, err.message || 'Failed to create owner');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/owners/:id/revoke   — demote a DB platform owner
// Clears isPlatformOwner (the account survives as a normal admin). Env owners
// can't be revoked here (their access comes from the server env, not the DB).
// ---------------------------------------------------------------------------
export const revokeOwner = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid owner id');

        const me = req.platformAdmin || {};
        if (me.id && String(me.id) === String(id)) {
            return fail(res, 400, 'You cannot revoke your own platform access.');
        }

        const admin = await runAsSystem(() =>
            AdminModel.findById(id).select('username email isPlatformOwner').lean().exec(),
        );
        if (!admin) return fail(res, 404, 'Owner not found');
        if (isPlatformEmail(admin.email)) {
            return fail(res, 409, 'This owner is granted via the server ADMIN_EMAILS list. Remove them there to revoke.');
        }
        if (!admin.isPlatformOwner) return ok(res, 'This account is already not a platform owner.', {});

        await runAsSystem(() => AdminModel.updateOne({ _id: id }, { $set: { isPlatformOwner: false } }).exec());
        logger.info({ id, by: me.email }, 'platform.revokeOwner');
        return ok(res, `Revoked platform access for "${admin.username}".`, {});
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to revoke owner');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/admins/:id/password   — reset ANY admin's password
// Body: { password }.  Works for platform owners and store owners alike.
// ---------------------------------------------------------------------------
export const resetAdminPassword = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid account id');
        const password = String(req.body?.password || '');
        if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters.');

        const admin = await runAsSystem(() =>
            AdminModel.findById(id).select('+passwordHash username').exec(),
        );
        if (!admin) return fail(res, 404, 'Account not found');

        admin.passwordHash = await bcrypt.hash(password, 10);
        await admin.save();
        logger.info({ id, by: req.platformAdmin?.email }, 'platform.resetAdminPassword');
        return ok(res, `Password reset for "${admin.username}".`, {});
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to reset password');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/admins/:id/toggle   — flip an admin's isActive
// Can't deactivate yourself, nor an env-bootstrap platform owner (lockout-proof).
// ---------------------------------------------------------------------------
export const toggleAdminActive = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid account id');

        const me = req.platformAdmin || {};
        if (me.id && String(me.id) === String(id)) {
            return fail(res, 400, 'You cannot deactivate your own account.');
        }

        const admin = await runAsSystem(() =>
            AdminModel.findById(id).select('username email isActive').exec(),
        );
        if (!admin) return fail(res, 404, 'Account not found');
        if (admin.isActive && isPlatformEmail(admin.email)) {
            return fail(res, 409, 'This platform owner is defined in the server env and cannot be deactivated here.');
        }

        admin.isActive = !admin.isActive;
        await admin.save();
        logger.info({ id, isActive: admin.isActive, by: me.email }, 'platform.toggleAdminActive');
        return ok(res, `${admin.isActive ? 'Activated' : 'Deactivated'} "${admin.username}".`, {
            isActive: admin.isActive,
        });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to update account');
    }
};

// ---------------------------------------------------------------------------
// GET /api/platform/store-owners   — every tenant with its owner account
// ---------------------------------------------------------------------------
export const listStoreOwners = async (req, res) => {
    try {
        const tenants = await TenantModel.find({})
            .select('businessName subdomain status isPrimary ownerAdminId ownerEmail createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const ownerIds = tenants.map((t) => t.ownerAdminId).filter(Boolean);
        const admins = ownerIds.length
            ? await runAsSystem(() =>
                  AdminModel.find({ _id: { $in: ownerIds } })
                      .select('username email fullName isActive lastLoginAt isPlatformOwner')
                      .lean()
                      .exec(),
              )
            : [];
        const byId = new Map(admins.map((a) => [String(a._id), a]));

        const owners = tenants.map((t) => {
            const a = t.ownerAdminId ? byId.get(String(t.ownerAdminId)) : null;
            return {
                tenantId: t._id,
                businessName: t.businessName,
                subdomain: t.subdomain,
                status: t.status,
                isPrimary: !!t.isPrimary,
                owner: a
                    ? {
                          id: a._id,
                          username: a.username,
                          email: a.email || t.ownerEmail || null,
                          fullName: a.fullName || '',
                          isActive: a.isActive !== false,
                          lastLoginAt: a.lastLoginAt || null,
                          isPlatformOwner: !!a.isPlatformOwner,
                      }
                    : t.ownerEmail
                        ? { id: null, username: null, email: t.ownerEmail, fullName: '', isActive: false, lastLoginAt: null, isPlatformOwner: false }
                        : null,
            };
        });

        return ok(res, 'Store owners', { owners, count: owners.length });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to list store owners');
    }
};

// ---------------------------------------------------------------------------
// POST /api/platform/tenants/:id/impersonate   — "log in as" the store owner
// Mints a short-lived admin token bound to that store so the platform owner can
// step into the store's admin panel to help. Only approved stores with an active
// owner can be entered.
// ---------------------------------------------------------------------------
export const impersonateStoreOwner = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid tenant id');

        const tenant = await TenantModel.findById(id).lean();
        if (!tenant) return fail(res, 404, 'Tenant not found');
        if (!tenant.ownerAdminId) return fail(res, 400, 'This store has no owner account.');
        if (tenant.status !== 'approved') return fail(res, 409, 'Only an approved store can be accessed.');

        const owner = await runAsSystem(() =>
            AdminModel.findById(tenant.ownerAdminId)
                .select('username email role isActive')
                .lean()
                .exec(),
        );
        if (!owner) return fail(res, 404, 'Store owner account not found.');
        if (owner.isActive === false) return fail(res, 409, 'The store owner account is deactivated. Activate it first.');

        const token = jwt.sign(
            {
                sub: String(owner._id),
                username: owner.username,
                role: owner.role || 'super-admin',
                email: owner.email || undefined,
                tenantId: String(tenant._id),
                imp: true,                                   // marks an impersonation session
                by: req.platformAdmin?.email || 'platform',  // audit: who entered
            },
            process.env.JWT_SECRET,
            { expiresIn: '2h' },
        );

        logger.info({ tenantId: id, by: req.platformAdmin?.email }, 'platform.impersonate');
        return ok(res, `Signed in as ${owner.username} — ${tenant.businessName}.`, {
            token,
            store: { businessName: tenant.businessName, subdomain: tenant.subdomain, owner: owner.username },
        });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to access store');
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
