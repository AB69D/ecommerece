import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import PlanModel from '../models/plan.model.js';
import TenantModel from '../models/tenant.model.js';
import SubscriptionModel from '../models/subscription.model.js';

// ── Tenancy bootstrap (idempotent) ──────────────────────────────────────────
// Ensures the SaaS scaffolding exists for the CURRENT live business ("tenant
// zero") without changing any existing data. Runs once at startup inside a
// system context. Creating these rows is purely additive — new collections,
// untouched legacy collections — so it is safe to run on every boot.
//
// What it guarantees:
//   1. a 'default' Plan exists (unlimited, free) for the primary store,
//   2. a single primary Tenant (isPrimary:true) exists for the live business,
//   3. that tenant has an active Subscription.
//
// Phase 1 then back-fills tenantId = <this tenant's _id> onto every existing
// document before enabling required:true + the scoping plugin.

export async function bootstrapTenancy() {
    // 1) Default plan for the primary store: unlimited sales, no overage, free.
    let plan = await PlanModel.findOne({ slug: 'default' });
    if (!plan) {
        plan = await PlanModel.create({
            name: 'Default',
            slug: 'default',
            description: 'Built-in plan for the primary store.',
            price: 0,
            billingInterval: 'monthly',
            currency: env.PLATFORM_CURRENCY,
            salesLimit: 0, // unlimited — the primary store is never throttled
            overage: { mode: 'none' },
            limits: {},
            isActive: true,
            isPublic: false,
        });
        logger.info('Tenancy bootstrap: created default plan');
    }

    // 2) The primary tenant (the existing live business). Keyed by isPrimary so
    //    re-runs never create a second one even if the subdomain is changed.
    let tenant = await TenantModel.findOne({ isPrimary: true });
    if (!tenant) {
        const now = new Date();
        tenant = await TenantModel.create({
            businessName: 'Primary Store',
            subdomain: env.TENANT_ZERO_SUBDOMAIN,
            status: 'approved',
            isPrimary: true,
            planId: plan._id,
            approvedAt: now,
            provisionedAt: now,
            billing: { status: 'active' },
        });
        logger.info(`Tenancy bootstrap: created primary tenant (${tenant.subdomain})`);
    }

    // 3) Active subscription for the primary tenant.
    const sub = await SubscriptionModel.findOne({ tenantId: tenant._id });
    if (!sub) {
        await SubscriptionModel.create({
            tenantId: tenant._id,
            planId: plan._id,
            status: 'active',
            interval: 'monthly',
            currentPeriodStart: new Date(),
        });
        logger.info('Tenancy bootstrap: created primary subscription');
    }

    return tenant;
}
