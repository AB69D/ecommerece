import { Router } from 'express';
import { getStockLedger } from '../controllers/stock.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/ledger', requirePermission('inventory:read'), getStockLedger);

export default router;
