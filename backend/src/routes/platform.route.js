import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    registerStore,
    listTenants,
    getTenant,
    approveTenant,
    suspendTenant,
    rejectTenant,
} from '../controllers/platform.controller.js';
import { requireSuperAdmin } from '../middlewares/platformAuth.middleware.js';

const router = Router();

// Public store registration is abuse-prone (creates DB rows), so cap it hard.
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many registration attempts, please try again later.' },
});

// Public: a prospective store owner signs up (pending until approved).
router.post('/register', registerLimiter, registerStore);

// Everything below is platform super-admin only (env owner allow-list).
router.use(requireSuperAdmin);
router.get('/tenants', listTenants);
router.get('/tenants/:id', getTenant);
router.post('/tenants/:id/approve', approveTenant);
router.post('/tenants/:id/suspend', suspendTenant);
router.post('/tenants/:id/reject', rejectTenant);

export default router;
