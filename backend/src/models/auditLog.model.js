import mongoose from 'mongoose';

// ---------------------------------------------------------------
// Immutable audit trail of admin actions.
//
// Written automatically for every state-changing admin request by the
// `auditMutations` middleware, and can be enriched by controllers via
// `req.audit({ ... })`.
// ---------------------------------------------------------------
const auditLogSchema = new mongoose.Schema(
    {
        actor: {
            id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
            username: { type: String, default: 'system' },
            role: { type: String, default: '' },
        },
        action: { type: String, required: true, index: true }, // e.g. "user.create"
        resource: { type: String, default: '', index: true }, // e.g. "Admin"
        resourceId: { type: String, default: '' },
        method: { type: String, default: '' },
        path: { type: String, default: '' },
        statusCode: { type: Number },
        ip: { type: String, default: '' },
        userAgent: { type: String, default: '' },
        message: { type: String, default: '' },
        // Optional before/after snapshots and arbitrary metadata.
        before: { type: mongoose.Schema.Types.Mixed },
        after: { type: mongoose.Schema.Types.Mixed },
        meta: { type: mongoose.Schema.Types.Mixed },
        success: { type: Boolean, default: true },
    },
    { timestamps: true },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'actor.id': 1, createdAt: -1 });

const AuditLogModel = mongoose.model('AuditLog', auditLogSchema);

export default AuditLogModel;
