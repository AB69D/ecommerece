import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
    register,
    login,
    me,
    updateProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    orders,
    listAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
} from '../controllers/clientAuth.controller.js';
import { requireCustomer } from '../middlewares/clientAuth.middleware.js';

const router = Router();

// Brute-force guard on credential endpoints (mirrors the admin authLimiter:
// 20 attempts / 15 min). The rest of the router relies on the global /api
// limiter so frequent reads (me, orders, addresses) aren't throttled.
const credentialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts, please try again later.' },
});

// Public credential endpoints
router.post('/register', credentialLimiter, register);
router.post('/login', credentialLimiter, login);
// Forgot/reset password — also rate-limited (they send mail / accept tokens).
router.post('/forgot-password', credentialLimiter, forgotPassword);
router.post('/reset-password', credentialLimiter, resetPassword);

// Authenticated account endpoints
router.get('/me', requireCustomer, me);
router.patch('/me', requireCustomer, updateProfile);
router.post('/change-password', requireCustomer, credentialLimiter, changePassword);
router.get('/orders', requireCustomer, orders);

router.get('/addresses', requireCustomer, listAddresses);
router.post('/addresses', requireCustomer, addAddress);
router.patch('/addresses/:addressId', requireCustomer, updateAddress);
router.delete('/addresses/:addressId', requireCustomer, deleteAddress);
router.patch('/addresses/:addressId/default', requireCustomer, setDefaultAddress);

export default router;
