import express from 'express';
import {
    getAllAdmins,
    getAdmin,
    addAdmin,
    updateAdmin,
    resetPassword,
    removeAdmin,
    changeOwnPassword,
} from '../controllers/adminMgmt.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';
import { validate } from '../utils/validate.js';
import {
    createAdminSchema,
    updateAdminSchema,
    resetPasswordSchema,
    changePasswordSchema,
} from '../validations/admin.schema.js';

const router = express.Router();

// Self-service (any authenticated admin) — must be declared before "/:id".
router.patch('/me/password', validate({ body: changePasswordSchema }), changeOwnPassword);

router.get('/', requirePermission('user:read'), getAllAdmins);
router.post('/', requirePermission('user:write'), validate({ body: createAdminSchema }), addAdmin);
router.get('/:id', requirePermission('user:read'), getAdmin);
router.patch('/:id', requirePermission('user:write'), validate({ body: updateAdminSchema }), updateAdmin);
router.post(
    '/:id/reset-password',
    requirePermission('user:write'),
    validate({ body: resetPasswordSchema }),
    resetPassword,
);
router.delete('/:id', requirePermission('user:delete'), removeAdmin);

export default router;
