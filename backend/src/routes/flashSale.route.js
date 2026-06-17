import { Router } from 'express';
import {
    listFlashSales,
    getFlashSale,
    createFlashSale,
    updateFlashSale,
    deleteFlashSale,
    getActiveFlashSales,
} from '../controllers/flashSale.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

// Admin routes — mounted under requireAuth in server.js.
// Flash sales fall under the "discount" permission resource because they are
// a promotional / pricing feature alongside coupons and product discounts.
const admin = Router();

admin.get('/', requirePermission('discount:read'), listFlashSales);
admin.get('/:id', requirePermission('discount:read'), getFlashSale);
admin.post('/', requirePermission('discount:write'), createFlashSale);
admin.put('/:id', requirePermission('discount:write'), updateFlashSale);
admin.patch('/:id', requirePermission('discount:write'), updateFlashSale);
admin.delete('/:id', requirePermission('discount:delete'), deleteFlashSale);

// Public / client routes — unauthenticated, used by the storefront.
const client = Router();

client.get('/active', getActiveFlashSales);

export default { admin, client };
