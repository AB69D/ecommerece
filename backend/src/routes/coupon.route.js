import { Router } from 'express';
import {
    listCoupons,
    createCoupon,
    updateCoupon,
    deleteCoupon,
    validateCoupon,
} from '../controllers/coupon.controller.js';
import { validate } from '../utils/validate.js';
import {
    createCouponSchema,
    updateCouponSchema,
    validateCouponSchema,
    listCouponQuerySchema,
} from '../validations/coupon.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

// Admin CRUD (mounted under requireAuth). Coupons live under the existing
// "discount" (Discounts / Promotions) permission resource.
const admin = Router();
admin.get('/', requirePermission('discount:read'), validate({ query: listCouponQuerySchema }), listCoupons);
admin.post('/', requirePermission('discount:write'), validate({ body: createCouponSchema }), createCoupon);
admin.put('/:id', requirePermission('discount:write'), validate({ body: updateCouponSchema }), updateCoupon);
admin.patch('/:id', requirePermission('discount:write'), validate({ body: updateCouponSchema }), updateCoupon);
admin.delete('/:id', requirePermission('discount:delete'), deleteCoupon);
// Validate/preview is available to any authenticated staff member (incl. POS
// cashiers, who hold no discount:* grants) so they can apply codes at the till.
admin.post('/validate', validate({ body: validateCouponSchema }), validateCoupon);

// Public storefront validate/preview (unauthenticated).
const client = Router();
client.post('/validate', validate({ body: validateCouponSchema }), validateCoupon);

export default { admin, client };
