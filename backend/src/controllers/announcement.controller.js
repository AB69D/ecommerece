import mongoose from 'mongoose';
import AnnouncementModel from '../models/announcement.model.js';
import TenantModel from '../models/tenant.model.js';
import { getEffectiveTenantId } from '../tenancy/tenantContext.js';
import { sendEmail, emailEnabled } from '../lib/mailer.js';
import { logger } from '../lib/logger.js';

// Platform announcements run in the system (cross-tenant) context — the model is
// not tenant-scoped; targeting is explicit via audience/targetTenantId.
const ok = (res, message, data) => res.json({ success: true, error: false, message, data });
const fail = (res, code, message) => res.status(code).json({ success: false, error: true, message });

const LEVELS = ['info', 'warning', 'critical'];

// GET /api/platform/announcements — every announcement, newest first.
export const listAnnouncements = async (_req, res) => {
    try {
        const announcements = await AnnouncementModel.find({}).sort({ createdAt: -1 }).limit(200).lean();
        // Decorate store-targeted ones with the store name for the UI.
        const ids = [...new Set(announcements.filter((a) => a.targetTenantId).map((a) => String(a.targetTenantId)))];
        const tenants = ids.length
            ? await TenantModel.find({ _id: { $in: ids } }).select('businessName subdomain').lean()
            : [];
        const nameById = Object.fromEntries(tenants.map((t) => [String(t._id), t.businessName]));
        const rows = announcements.map((a) => ({
            ...a,
            targetStoreName: a.targetTenantId ? nameById[String(a.targetTenantId)] || null : null,
        }));
        return ok(res, 'Announcements', { announcements: rows, count: rows.length });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to list announcements');
    }
};

// POST /api/platform/announcements
// { title, body, level?, audience?, targetTenantId?, expiresAt?, sendEmail? }
export const createAnnouncement = async (req, res) => {
    try {
        const b = req.body || {};
        const title = String(b.title || '').trim();
        const body = String(b.body || '').trim();
        if (!title) return fail(res, 400, 'Title is required.');
        if (!body) return fail(res, 400, 'Message body is required.');

        const level = LEVELS.includes(b.level) ? b.level : 'info';
        const audience = b.audience === 'store' ? 'store' : 'all';

        let targetTenantId = null;
        let target = null;
        if (audience === 'store') {
            if (!mongoose.isValidObjectId(b.targetTenantId)) return fail(res, 400, 'Choose a store to target.');
            target = await TenantModel.findById(b.targetTenantId).select('businessName ownerEmail').lean();
            if (!target) return fail(res, 404, 'Target store not found.');
            targetTenantId = target._id;
        }

        let expiresAt = null;
        if (b.expiresAt) {
            const d = new Date(b.expiresAt);
            if (!Number.isNaN(d.getTime())) expiresAt = d;
        }

        const doc = await AnnouncementModel.create({
            title, body, level, audience, targetTenantId, expiresAt,
            createdBy: req.platformAdmin?.email || req.platformAdmin?.username || 'platform',
        });

        // Optional email to the affected store owner(s). Best-effort: never let a
        // mail failure fail the request.
        let emailedCount = 0;
        if (b.sendEmail && emailEnabled()) {
            try {
                let recipients = [];
                if (audience === 'store') {
                    if (target?.ownerEmail) recipients = [{ to: target.ownerEmail, name: target.businessName }];
                } else {
                    const stores = await TenantModel.find({ status: 'approved', ownerEmail: { $nin: [null, ''] } })
                        .select('businessName ownerEmail')
                        .lean();
                    recipients = stores.map((s) => ({ to: s.ownerEmail, name: s.businessName }));
                }
                const results = await Promise.allSettled(
                    recipients.map((r) =>
                        sendEmail({
                            to: r.to,
                            toName: r.name,
                            subject: title,
                            text: body,
                            html: `<h2 style="margin:0 0 12px">${escapeHtml(title)}</h2><div style="white-space:pre-wrap">${escapeHtml(body)}</div>`,
                        }),
                    ),
                );
                emailedCount = results.filter((r) => r.status === 'fulfilled').length;
                await AnnouncementModel.updateOne({ _id: doc._id }, { $set: { emailSent: emailedCount > 0, emailedCount } });
            } catch (mailErr) {
                logger.error({ err: mailErr }, 'announcement email failed');
            }
        }

        logger.info({ id: String(doc._id), audience, level, emailedCount, by: req.platformAdmin?.email }, 'platform.createAnnouncement');
        return ok(res, b.sendEmail ? `Announcement posted${emailedCount ? ` and emailed to ${emailedCount} owner(s)` : ''}.` : 'Announcement posted.', {
            announcement: { ...doc.toObject(), emailedCount },
        });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to create announcement');
    }
};

// POST /api/platform/announcements/:id/deactivate — stop showing it.
export const deactivateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid announcement id');
        const doc = await AnnouncementModel.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true }).lean();
        if (!doc) return fail(res, 404, 'Announcement not found');
        return ok(res, 'Announcement deactivated.', { announcement: doc });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to deactivate announcement');
    }
};

// GET /api/admin/announcements — the active notices for the signed-in store.
// Read-only; the model is not tenant-scoped so targeting is filtered explicitly.
export const getMyAnnouncements = async (req, res) => {
    try {
        const tenantId = req.admin?.tenantId
            ? String(req.admin.tenantId)
            : (getEffectiveTenantId() ? String(getEffectiveTenantId()) : null);
        if (!tenantId) return ok(res, 'Announcements', { announcements: [] });

        const now = new Date();
        const docs = await AnnouncementModel.find({
            isActive: true,
            startsAt: { $lte: now },
            $and: [
                { $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }] },
                { $or: [{ audience: 'all' }, { audience: 'store', targetTenantId: tenantId }] },
            ],
        })
            .sort({ level: 1, createdAt: -1 })
            .limit(20)
            .lean();

        const announcements = docs.map((a) => ({
            id: String(a._id),
            title: a.title,
            body: a.body,
            level: a.level,
            createdAt: a.createdAt,
        }));
        return ok(res, 'Announcements', { announcements });
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to load announcements');
    }
};

// Minimal HTML escaping for the email body (titles/bodies are operator-authored
// but we still avoid breaking the markup).
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
