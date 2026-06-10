import { Router } from 'express';
import { getDashboardOverview, getProfitReport } from '../controllers/analytics.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/overview', requirePermission('analytics:read'), getDashboardOverview);
router.get('/profit', requirePermission('analytics:read'), getProfitReport);

export default router;
