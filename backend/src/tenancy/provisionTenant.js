import PlanModel from '../models/plan.model.js';
import SubscriptionModel from '../models/subscription.model.js';
import { SiteSettings } from '../models/siteSettings.model.js';
import { Footer } from '../models/footer.model.js';
import { NavMenuItem } from '../models/navMenu.model.js';
import { runAsTenant } from './tenantContext.js';
import { logger } from '../lib/logger.js';

// ── Tenant provisioning ─────────────────────────────────────────────────────
// Turn a freshly-approved tenant into a usable store: attach a plan + an active
// subscription and stamp provisionedAt. Idempotent — safe to re-run (used by the
// super-admin approve action).
//
// A new store starts BLANK on purpose: the admin panel is fully dynamic, so the
// owner fills in business info, branding, categories and products themselves.
// (Richer seed data — default nav/footer/site-settings — can be added here later
// if a blank storefront ever needs scaffolding.)
export async function provisionTenant(tenant) {
    const tenantId = tenant._id;

    // Attach the built-in plan until Phase 4 introduces public, billable plans.
    let plan = await PlanModel.findOne({ slug: 'default' });
    if (!plan) {
        // Defensive: bootstrapTenancy normally creates this at startup.
        plan = await PlanModel.create({
            name: 'Default',
            slug: 'default',
            description: 'Built-in starter plan.',
            price: 0,
            billingInterval: 'monthly',
            salesLimit: 0,
            overage: { mode: 'none' },
            isActive: true,
            isPublic: false,
        });
        logger.info('Provision: created missing default plan');
    }

    if (!tenant.planId) tenant.planId = plan._id;

    // One active subscription per tenant (the model enforces unique tenantId).
    const existing = await SubscriptionModel.findOne({ tenantId });
    if (!existing) {
        await SubscriptionModel.create({
            tenantId,
            planId: plan._id,
            status: 'active',
            interval: 'monthly',
            currentPeriodStart: new Date(),
        });
        logger.info({ tenantId: String(tenantId) }, 'Provision: created subscription');
    }

    // Seed default tenant-scoped documents so the storefront and admin panel
    // have a valid baseline immediately after approval (no blank-page 404s).
    await runAsTenant(tenantId, async () => {
        // SiteSettings singleton — needed for feature flags (isFeatureEnabled).
        const existingSettings = await SiteSettings.findOne({ key: 'global' });
        if (!existingSettings) {
            await SiteSettings.create({ key: 'global' });
            logger.info({ tenantId: String(tenantId) }, 'Provision: created default SiteSettings');
        }

        // NavMenu — seed a basic home link so the header renders something.
        const existingNav = await NavMenuItem.findOne({ location: 'header' });
        if (!existingNav) {
            await NavMenuItem.create({
                label: 'Home',
                url: '/',
                location: 'header',
                order: 0,
                isVisible: true,
            });
            logger.info({ tenantId: String(tenantId) }, 'Provision: created default NavMenu');
        }

        // Footer singleton.
        const existingFooter = await Footer.findOne({ key: 'global' });
        if (!existingFooter) {
            await Footer.create({ key: 'global' });
            logger.info({ tenantId: String(tenantId) }, 'Provision: created default Footer');
        }
    });

    if (!tenant.provisionedAt) tenant.provisionedAt = new Date();
    await tenant.save();
    return tenant;
}

export default provisionTenant;
