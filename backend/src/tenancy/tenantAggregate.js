import mongoose from 'mongoose';
import { getEffectiveTenantId, isSystemContext } from './tenantContext.js';

// ── tenantAggregate — safe aggregate wrapper ─────────────────────────────────
// Prevents developers from forgetting the tenantId $match in aggregation
// pipelines, which bypass the Mongoose query middleware that tenantPlugin uses.
//
// Usage:
//
//   import { tenantAggregate } from '../tenancy/tenantAggregate.js';
//
//   // tenantId from ALS (admin routes / background jobs):
//   const rows = await tenantAggregate(OrderModel, [
//       { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
//   ]);
//
//   // tenantId from req (client routes that read from req directly):
//   const rows = await tenantAggregate(OrderModel, pipeline, req.tenant?._id);
//
// The function:
//   1. Resolves tenantId: explicit argument > ALS context > throws (enforcement ON)
//      or no-ops (enforcement OFF).
//   2. Coerces tenantId to ObjectId (Mongo aggregation $match is raw; a string
//      never equals a stored ObjectId, silently returning nothing).
//   3. Prepends { $match: { tenantId } } as the first stage UNLESS the first
//      stage is $geoNear or $search (which MongoDB requires to be first; the
//      caller is responsible for adding tenantId there or using a later $match).
//   4. In a system context (runAsSystem) skips all scoping, so cross-tenant
//      platform queries work exactly as before.
//
// ENFORCED: when TENANT_ENFORCEMENT=true and no tenantId can be resolved, throws
// rather than returning another tenant's data.

const MUST_BE_FIRST = new Set(['$geoNear', '$search', '$searchMeta', '$vectorSearch']);

/**
 * @param {mongoose.Model} Model     - a Mongoose model with the tenantPlugin applied
 * @param {Array}          pipeline  - aggregation stages (WITHOUT a leading tenantId $match)
 * @param {string|mongoose.Types.ObjectId|null} [explicitTenantId]
 *        - optional override (pass req.tenant._id on client routes)
 * @param {object} [options]         - forwarded to model.aggregate() (e.g. { allowDiskUse: true })
 * @returns {Promise<Array>}
 */
export async function tenantAggregate(Model, pipeline, explicitTenantId = null, options = {}) {
    // System (platform) context: skip all scoping, run raw.
    if (isSystemContext()) {
        return Model.aggregate(pipeline, options);
    }

    // Resolve tenant: explicit arg > ALS store.
    const rawId = explicitTenantId || getEffectiveTenantId();

    if (!rawId) {
        const { env } = await import('../config/env.js');
        if (env.TENANT_ENFORCEMENT) {
            throw new Error(
                `tenantAggregate: no tenant in context for ${Model.modelName}. ` +
                `Pass an explicit tenantId (req.tenant._id) or call inside withTenant / runAsTenant.`,
            );
        }
        // Lenient: pre-migration / single-tenant mode — run without scoping.
        return Model.aggregate(pipeline, options);
    }

    // Coerce to ObjectId: $match in aggregate is sent raw to MongoDB, so a
    // string tenantId silently matches nothing (the stored field is an ObjectId).
    const tid =
        rawId instanceof mongoose.Types.ObjectId
            ? rawId
            : mongoose.isValidObjectId(rawId)
                ? new mongoose.Types.ObjectId(String(rawId))
                : rawId; // unusual type — pass through and let Mongo error

    const tenantMatch = { $match: { tenantId: tid } };

    // If the pipeline starts with a stage that MUST be first, insert the tenant
    // match right after it. The caller is still responsible for ensuring the
    // must-be-first stage itself scopes correctly (e.g. $search index filters).
    const firstStageKey = pipeline.length > 0 ? Object.keys(pipeline[0])[0] : null;
    let scopedPipeline;
    if (firstStageKey && MUST_BE_FIRST.has(firstStageKey)) {
        scopedPipeline = [pipeline[0], tenantMatch, ...pipeline.slice(1)];
    } else {
        scopedPipeline = [tenantMatch, ...pipeline];
    }

    return Model.aggregate(scopedPipeline, options);
}

// Convenience: build a tenantId $match stage for callers that construct the
// pipeline themselves (inline use in clientReview, clientProduct, etc.).
// Returns { tenantId: <ObjectId> } or {} when no tenant / system context.
export function tenantMatchStage(explicitTenantId = null) {
    if (isSystemContext()) return {};
    const rawId = explicitTenantId || getEffectiveTenantId();
    if (!rawId) return {};
    const tid =
        rawId instanceof mongoose.Types.ObjectId
            ? rawId
            : mongoose.isValidObjectId(rawId)
                ? new mongoose.Types.ObjectId(String(rawId))
                : rawId;
    return { tenantId: tid };
}
