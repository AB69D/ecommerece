import { Router } from 'express';
import { getCatalog } from '../controllers/rbac.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

// Any admin who can read users can view the catalog (needed to assign roles).
router.get('/catalog', requirePermission('user:read'), getCatalog);

export default router;
