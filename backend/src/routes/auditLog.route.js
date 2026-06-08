import { Router } from 'express';
import { listAuditLogs, auditStats } from '../controllers/auditLog.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', requirePermission('audit:read'), listAuditLogs);
router.get('/stats', requirePermission('audit:read'), auditStats);

export default router;
