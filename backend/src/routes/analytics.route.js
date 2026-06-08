import { Router } from 'express';
import { getDashboardOverview } from '../controllers/analytics.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/overview', requirePermission('analytics:read'), getDashboardOverview);

export default router;
