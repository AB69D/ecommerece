import { Router } from 'express';
import { requirePermission } from '../middlewares/auth.middleware.js';
import {
    getOrderedCustomers,
    getAbandonedLeads,
    getCustomerStats
} from '../controllers/customer.controller.js';

// Admin-only customer directory: people who ordered + abandoned checkouts.
const customerRouter = Router();

customerRouter.get('/ordered', requirePermission('customer:read'), getOrderedCustomers);
customerRouter.get('/abandoned', requirePermission('customer:read'), getAbandonedLeads);
customerRouter.get('/stats', requirePermission('customer:read'), getCustomerStats);

export default customerRouter;
