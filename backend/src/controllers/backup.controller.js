import mongoose from 'mongoose';
import TenantModel from '../models/tenant.model.js';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import OrderModel from '../models/order.model.js';
import CustomerModel from '../models/customer.model.js';
import CouponModel from '../models/coupon.model.js';
import ReviewModel from '../models/review.model.js';
import AdminModel from '../models/admin.model.js';
import { runAsTenant } from '../tenancy/tenantContext.js';
import { logger } from '../lib/logger.js';

const fail = (res, code, message) => res.status(code).json({ success: false, error: true, message });

// GET /api/platform/tenants/:id/export — a full data backup for ONE store,
// streamed as a downloadable JSON file. Runs scoped to that tenant (runAsTenant)
// so the scoping plugin returns only its rows. Secrets are never included:
// password hashes and reset tokens are `select:false` on their models, so a
// default query omits them; staff are projected to safe fields only; site
// settings (which can hold gateway credentials) are intentionally excluded.
export const exportTenantData = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid store id');
        const tenant = await TenantModel.findById(id).lean();
        if (!tenant) return fail(res, 404, 'Store not found');

        const data = await runAsTenant(tenant._id, async () => {
            const [categories, products, orders, customers, coupons, reviews, staff] = await Promise.all([
                CategoryModel.find({}).lean(),
                ProductModel.find({}).lean(),
                OrderModel.find({}).lean(),
                CustomerModel.find({}).lean(), // passwordHash/resetToken* are select:false
                CouponModel.find({}).lean(),
                ReviewModel.find({}).lean(),
                AdminModel.find({})
                    .select('username email fullName role isActive createdAt lastLoginAt')
                    .lean(),
            ]);
            return { categories, products, orders, customers, coupons, reviews, staff };
        });

        const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length]));
        const bundle = {
            format: 'ab9d-ecommerce-store-backup',
            version: 1,
            exportedAt: new Date().toISOString(),
            exportedBy: req.platformAdmin?.email || 'platform',
            store: {
                id: String(tenant._id),
                businessName: tenant.businessName,
                subdomain: tenant.subdomain,
                status: tenant.status,
                createdAt: tenant.createdAt,
            },
            counts,
            data,
        };

        logger.info({ tenantId: id, by: req.platformAdmin?.email, counts }, 'platform.exportTenantData');

        const stamp = new Date().toISOString().slice(0, 10);
        const safeSub = String(tenant.subdomain || 'store').replace(/[^a-z0-9-]/gi, '') || 'store';
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${safeSub}-backup-${stamp}.json"`);
        return res.status(200).send(JSON.stringify(bundle, null, 2));
    } catch (err) {
        return fail(res, 500, err.message || 'Failed to export store data');
    }
};
