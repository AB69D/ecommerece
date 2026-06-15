import { Router } from 'express';
import { listNotificationsController } from '../controllers/notification.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const notificationRouter = Router();

// GET /api/admin/notifications
// Returns recent notification log entries (WhatsApp + email) for this tenant.
// Requires order:read — the same permission that can view orders is appropriate
// since notifications are tightly coupled to orders.
notificationRouter.get('/', requirePermission('order:read'), listNotificationsController);

export default notificationRouter;
