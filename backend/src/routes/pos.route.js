import { Router } from 'express';
import {
    getPosProducts,
    lookupByCode,
    createPosSale,
    returnPosSale,
    getPosSales,
    getPosReport,
} from '../controllers/pos.controller.js';
import {
    openShift,
    getCurrentShift,
    addMovement,
    closeShift,
    listShifts,
    getShift,
} from '../controllers/shift.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';
import { validate } from '../utils/validate.js';
import {
    createSaleSchema,
    returnSaleSchema,
    salesQuerySchema,
    productsQuerySchema,
    lookupQuerySchema,
    openShiftSchema,
    shiftMovementSchema,
    closeShiftSchema,
    shiftQuerySchema,
} from '../validations/pos.schema.js';

const router = Router();

// Catalog for the terminal.
router.get('/products', requirePermission('pos:read'), validate({ query: productsQuerySchema }), getPosProducts);

// Scanner: resolve a scanned barcode / typed SKU to a product + variant.
router.get('/lookup', requirePermission('pos:read'), validate({ query: lookupQuerySchema }), lookupByCode);

// Ring up a retail / wholesale sale, or process a return.
router.post('/sale', requirePermission('pos:sell'), validate({ body: createSaleSchema }), createPosSale);
router.post('/return', requirePermission('pos:sell'), validate({ body: returnSaleSchema }), returnPosSale);

// Reporting.
router.get('/sales', requirePermission('pos:read'), validate({ query: salesQuerySchema }), getPosSales);
router.get('/report', requirePermission('pos:read'), getPosReport);

// Shift / cash-drawer. Specific paths must precede the `/shift/:id` catch-all.
router.get('/shift/current', requirePermission('pos:read'), getCurrentShift);
router.post('/shift/open', requirePermission('pos:sell'), validate({ body: openShiftSchema }), openShift);
router.post('/shift/movement', requirePermission('pos:sell'), validate({ body: shiftMovementSchema }), addMovement);
router.post('/shift/close', requirePermission('pos:sell'), validate({ body: closeShiftSchema }), closeShift);
router.get('/shift', requirePermission('pos:read'), validate({ query: shiftQuerySchema }), listShifts);
router.get('/shift/:id', requirePermission('pos:read'), getShift);

export default router;
