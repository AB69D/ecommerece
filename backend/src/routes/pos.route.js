import { Router } from 'express';
import {
    getPosProducts,
    createPosSale,
    returnPosSale,
    getPosSales,
    getPosReport,
} from '../controllers/pos.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';
import { validate } from '../utils/validate.js';
import {
    createSaleSchema,
    returnSaleSchema,
    salesQuerySchema,
    productsQuerySchema,
} from '../validations/pos.schema.js';

const router = Router();

// Catalog for the terminal.
router.get('/products', requirePermission('pos:read'), validate({ query: productsQuerySchema }), getPosProducts);

// Ring up a retail / wholesale sale, or process a return.
router.post('/sale', requirePermission('pos:sell'), validate({ body: createSaleSchema }), createPosSale);
router.post('/return', requirePermission('pos:sell'), validate({ body: returnSaleSchema }), returnPosSale);

// Reporting.
router.get('/sales', requirePermission('pos:read'), validate({ query: salesQuerySchema }), getPosSales);
router.get('/report', requirePermission('pos:read'), getPosReport);

export default router;
