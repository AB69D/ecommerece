import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    registerStore,
    listTenants,
    getTenant,
    approveTenant,
    suspendTenant,
    rejectTenant,
    getTenantUsers,
    listOwners,
    createOwner,
    revokeOwner,
    resetAdminPassword,
    toggleAdminActive,
    listStoreOwners,
    impersonateStoreOwner,
    impersonateBySubdomain,
    getOverview,
    listPlans,
    createPlan,
    assignPlan,
    setBilling,
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

// Everything below is platform super-admin only (env allow-list OR the DB-backed
// isPlatformOwner flag — see requireSuperAdmin).
router.use(requireSuperAdmin);

// Platform owner home dashboard: stores + owners + order/revenue stats.
router.get('/overview', getOverview);

// Tenant fleet.
router.get('/tenants', listTenants);
router.get('/tenants/:id', getTenant);
router.get('/tenants/:id/users', getTenantUsers);
router.post('/tenants/:id/approve', approveTenant);
router.post('/tenants/:id/suspend', suspendTenant);
router.post('/tenants/:id/reject', rejectTenant);
router.post('/tenants/:id/impersonate', impersonateStoreOwner);
router.post('/stores/:subdomain/impersonate', impersonateBySubdomain);

// Platform owners (cross-tenant super-admins).
router.get('/owners', listOwners);
router.post('/owners', createOwner);
router.post('/owners/:id/revoke', revokeOwner);

// Plans & billing.
router.get('/plans', listPlans);
router.post('/plans', createPlan);
router.post('/tenants/:id/plan', assignPlan);
router.post('/tenants/:id/billing', setBilling);

// Store owners (the per-tenant owner accounts).
router.get('/store-owners', listStoreOwners);

// Account ops shared by both surfaces (keyed by the admin's _id).
router.post('/admins/:id/password', resetAdminPassword);
router.post('/admins/:id/toggle', toggleAdminActive);

export default router;
