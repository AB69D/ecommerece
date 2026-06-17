import CheckoutLeadModel from '../models/CheckoutLead.model.js';
import { sendAbandonedCartRecovery } from './whatsapp.js';
import { getSettings } from './siteSettings.js';
import { logger } from './logger.js';
import { runAsTenant } from '../tenancy/tenantContext.js';
import { env } from '../config/env.js';

// ── Abandoned Cart Recovery Job ───────────────────────────────────────────────
//
// Called on a 30-minute interval from server.js (after DB connect).
//
// For every CheckoutLead that:
//   - is still 'abandoned' (never converted to an order)
//   - has a customerPhone
//   - lastActivityAt is between 1h and 24h ago
//   - has fewer than 2 recovery attempts
//   - has never been attempted OR last attempt was >12h ago
//
// Checks the tenant's feature flag (features.abandonedCartRecovery) and
// WhatsApp feature flag before sending. Increments recoveryAttempts on every
// send attempt (success or API failure) so we don't hammer the same lead.
//
// Best-effort: individual lead failures are caught and logged; the loop
// continues to the next lead. The job itself never throws.

const MAX_ATTEMPTS = 2;
const MIN_AGE_MS = 60 * 60 * 1000;         // lead must be at least 1h old
const MAX_AGE_MS = 24 * 60 * 60 * 1000;    // lead must be at most 24h old
const MIN_RETRY_GAP_MS = 12 * 60 * 60 * 1000; // min 12h between recovery attempts
const BATCH_LIMIT = 200;                    // safety cap per run

export const recoverAbandonedCarts = async () => {
    const now = new Date();
    const minActivity = new Date(now - MAX_AGE_MS);
    const maxActivity = new Date(now - MIN_AGE_MS);
    const minRetry = new Date(now - MIN_RETRY_GAP_MS);

    let leads;
    try {
        // Cross-tenant query: tenantPlugin is bypassed when system=true in ALS.
        // We collect raw leads (with their tenantId) and then run each action
        // inside runAsTenant() so getSettings() resolves the right tenant's
        // settings document from the cache/DB.
        //
        // NOTE: This aggregate intentionally runs cross-tenant (system context).
        // We then verify the feature flag per-tenant inside the loop before
        // sending anything. No customer data is exposed cross-tenant.
        leads = await CheckoutLeadModel.aggregate([
            {
                $match: {
                    status: 'abandoned',
                    customerPhone: { $exists: true, $nin: ['', null] },
                    lastActivityAt: { $gte: minActivity, $lte: maxActivity },
                    recoveryAttempts: { $lt: MAX_ATTEMPTS },
                    $or: [
                        { lastRecoveryAt: null },
                        { lastRecoveryAt: { $lte: minRetry } },
                    ],
                },
            },
            { $limit: BATCH_LIMIT },
            // Only carry the fields we actually need
            {
                $project: {
                    _id: 1,
                    tenantId: 1,
                    customerPhone: 1,
                    customerName: 1,
                    itemCount: 1,
                    cartValue: 1,
                    recoveryAttempts: 1,
                },
            },
        ]);
    } catch (err) {
        logger.error({ err }, 'Abandoned cart recovery: failed to query leads');
        return;
    }

    if (!leads || leads.length === 0) return;

    logger.info({ count: leads.length }, 'Abandoned cart recovery: processing leads');

    for (const lead of leads) {
        try {
            await runAsTenant(lead.tenantId, async () => {
                const settings = await getSettings();

                // Gate 1: the abandonedCartRecovery feature must be enabled for this tenant.
                if (!settings?.features?.abandonedCartRecovery) return;

                // Gate 2: the WhatsApp integration must be enabled.
                if (!settings?.features?.whatsapp) return;

                // Resolve the recovery message template (falls back to model default).
                const template = settings?.whatsapp?.recoveryTemplate;
                if (!template) return;

                // Build checkout URL. Prefer FRONTEND_URL env; otherwise fall back to
                // a sensible placeholder (merchant can customise via the template variable).
                const baseUrl = env.FRONTEND_URL
                    ? env.FRONTEND_URL.replace(/\/$/, '')
                    : `https://${settings.siteName || 'yourstore'}.com`;
                const checkoutUrl = `${baseUrl}/cart`;

                const result = await sendAbandonedCartRecovery(
                    lead.customerPhone,
                    lead.customerName,
                    lead.itemCount || 1,
                    lead.cartValue || 0,
                    checkoutUrl,
                    template,
                );

                // Increment attempt counter regardless of API success/failure so we
                // never hammer a lead that keeps failing (bad number, etc.).
                await CheckoutLeadModel.updateOne(
                    { _id: lead._id },
                    {
                        $inc: { recoveryAttempts: 1 },
                        $set: { lastRecoveryAt: now },
                    },
                );

                if (result.ok) {
                    logger.info(
                        { leadId: lead._id, messageId: result.messageId },
                        'Abandoned cart recovery: WhatsApp sent',
                    );
                } else if (!result.skipped) {
                    logger.warn(
                        { leadId: lead._id, error: result.error },
                        'Abandoned cart recovery: WhatsApp send failed',
                    );
                }
            });
        } catch (err) {
            logger.error({ err, leadId: lead._id }, 'Abandoned cart recovery: error processing lead');
        }
    }
};
