import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { getTenantId, isSystemContext } from './tenantContext.js';

// ── Tenant scoping plugin ───────────────────────────────────────────────────
// Applied to every TENANT-OWNED schema (see tenantModels.js). It does two jobs,
// centrally, so the ~22 existing controllers barely change:
//   • WRITE  : stamp the current tenantId onto new documents.
//   • READ   : inject { tenantId } into every query and aggregation.
//
// Behaviour when NO tenant is in context (and it is not a system op) is gated by
// the TENANT_ENFORCEMENT flag, so we can roll this out safely:
//   • enforcement OFF (Phase 0/1 pre-migration, single tenant): act as a no-op
//     so the live site keeps working before data carries tenantId.
//   • enforcement ON  (Phase 1+ after back-fill): FAIL LOUD — throw rather than
//     risk returning another tenant's data. A cross-tenant leak becomes a
//     visible error caught in testing, not a silent breach.
//
// IMPORTANT: this plugin is NOT applied to any existing model in Phase 0. It is
// wired model-by-model in Phase 1, together with the data migration and the
// compound-index changes.

// Read ops that accept a query filter. (estimatedDocumentCount is intentionally
// excluded — it counts the whole collection and rejects a filter.)
const FILTERED_OPS = [
    'count',
    'countDocuments',
    'find',
    'findOne',
    'findOneAndDelete',
    'findOneAndRemove',
    'findOneAndReplace',
    'findOneAndUpdate',
    'replaceOne',
    'update',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'distinct',
];

export function tenantPlugin(schema) {
    // tenantId is indexed but NOT required here. The Phase 1 migration back-fills
    // existing rows and only THEN adds the required constraint, so enabling the
    // plugin can never reject a legitimate legacy document mid-rollout.
    schema.add({
        tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    });

    // Stamp tenantId on create/save for single documents.
    schema.pre('save', function stampTenant(next) {
        if (!this.tenantId) {
            const tenantId = getTenantId();
            if (tenantId) this.tenantId = tenantId;
        }
        next();
    });

    // Stamp tenantId on bulk inserts.
    schema.pre('insertMany', function stampMany(next, docs) {
        const tenantId = getTenantId();
        if (tenantId && Array.isArray(docs)) {
            for (const doc of docs) {
                if (doc && !doc.tenantId) doc.tenantId = tenantId;
            }
        }
        next();
    });

    // Inject { tenantId } into every read/update/delete filter.
    FILTERED_OPS.forEach((op) => {
        schema.pre(op, function scopeQuery(next) {
            if (isSystemContext()) return next(); // intentional cross-tenant op
            const tenantId = getTenantId();
            if (!tenantId) {
                if (env.TENANT_ENFORCEMENT) {
                    return next(new Error(`Tenant scope missing for ${op} on ${this.model?.modelName ?? 'model'}`));
                }
                return next(); // lenient: pre-migration / single-tenant mode
            }
            this.where({ tenantId });
            next();
        });
    });

    // Aggregations bypass query hooks, so guard them separately by prepending a
    // $match. (Caveat: a pipeline that must start with $search/$geoNear needs a
    // manual system-context escape — reviewed per-pipeline in Phase 1.)
    schema.pre('aggregate', function scopeAggregate(next) {
        if (isSystemContext()) return next();
        const tenantId = getTenantId();
        if (!tenantId) {
            if (env.TENANT_ENFORCEMENT) {
                return next(new Error('Tenant scope missing for aggregate'));
            }
            return next();
        }
        this.pipeline().unshift({ $match: { tenantId } });
        next();
    });
}
