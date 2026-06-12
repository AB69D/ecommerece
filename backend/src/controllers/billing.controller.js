import TenantModel from '../models/tenant.model.js';
import PlanModel from '../models/plan.model.js';
import SubscriptionModel from '../models/subscription.model.js';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import AdminModel from '../models/admin.model.js';
import OrderModel from '../models/order.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import { getEffectiveTenantId } from '../tenancy/tenantContext.js';

// GET /api/admin/billing — the signed-in store's OWN plan, subscription, usage
// and balance. Read-only and scoped to the caller's store: the tenant/plan/
// subscription are read by the token's tenantId, and the usage counts run in the
// request's tenant context so they reflect only this store's data.
export const getMyBilling = asyncHandler(async (req, res) => {
    const tenantId = req.admin?.tenantId
        ? String(req.admin.tenantId)
        : (getEffectiveTenantId() ? String(getEffectiveTenantId()) : null);

    if (!tenantId) {
        return ok(res, { store: null, plan: null, billing: null, subscription: null, usage: null }, 'Billing');
    }

    const tenant = await TenantModel.findById(tenantId)
        .select('businessName subdomain status billing planId createdAt')
        .lean();
    const plan = tenant?.planId ? await PlanModel.findById(tenant.planId).lean() : null;
    const subscription = await SubscriptionModel.findOne({ tenantId }).lean();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [products, categories, staff, ordersThisMonth] = await Promise.all([
        ProductModel.countDocuments({}),
        CategoryModel.countDocuments({}),
        AdminModel.countDocuments({}),
        OrderModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
    ]);

    return ok(
        res,
        {
            store: tenant
                ? { businessName: tenant.businessName, subdomain: tenant.subdomain, status: tenant.status, since: tenant.createdAt }
                : null,
            plan: plan
                ? {
                      name: plan.name,
                      slug: plan.slug,
                      price: plan.price,
                      currency: plan.currency,
                      interval: plan.billingInterval,
                      salesLimit: plan.salesLimit,
                      overage: plan.overage,
                      limits: plan.limits,
                  }
                : null,
            billing: tenant?.billing || null,
            subscription: subscription
                ? {
                      status: subscription.status,
                      interval: subscription.interval,
                      currentPeriodStart: subscription.currentPeriodStart,
                      currentPeriodEnd: subscription.currentPeriodEnd,
                  }
                : null,
            usage: { products, categories, staff, ordersThisMonth },
        },
        'Billing',
    );
});
