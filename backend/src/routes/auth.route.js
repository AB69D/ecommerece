import express from 'express';
import { sendCode, verifyCode, verifyToken, login, me } from '../controllers/auth.controller.js';

const router = express.Router();

// Username + password (preferred)
router.post('/login', login);
router.get('/me', me);

// Legacy email OTP — kept for backward compatibility.
router.post('/send-code', sendCode);
router.post('/verify-code', verifyCode);
router.get('/verify-token', verifyToken);

export default router;
