import mongoose from 'mongoose';

// ── Announcement (platform-level; NOT tenant-scoped) ────────────────────────
// A notice the PLATFORM owner sends to store owners — shown as a banner inside
// the store admin and (optionally) emailed. It deliberately does NOT use the
// tenant scoping plugin: an announcement either targets EVERY store
// (audience 'all') or ONE specific store (audience 'store' + targetTenantId),
// and the store-side read filters on that explicitly. Created and managed only
// in the platform (system) context.

const announcementSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, maxlength: 140 },
        body: { type: String, required: true, trim: true, maxlength: 4000 },

        // Visual severity of the in-admin banner.
        level: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },

        // 'all' => every store; 'store' => only targetTenantId.
        audience: { type: String, enum: ['all', 'store'], default: 'all', index: true },
        targetTenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },

        isActive: { type: Boolean, default: true, index: true },
        // Scheduling window. startsAt defaults to now; expiresAt is optional.
        startsAt: { type: Date, default: Date.now },
        expiresAt: { type: Date },

        // Audit / email bookkeeping.
        createdBy: { type: String, default: '' },
        emailSent: { type: Boolean, default: false },
        emailedCount: { type: Number, default: 0 },
    },
    { timestamps: true },
);

// Fast lookup for "active notices for this store right now".
announcementSchema.index({ isActive: 1, audience: 1, startsAt: 1 });

const AnnouncementModel = mongoose.model('Announcement', announcementSchema);

export default AnnouncementModel;
