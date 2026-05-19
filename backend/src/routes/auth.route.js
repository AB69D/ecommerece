import express from 'express';
import { sendCode, verifyCode, verifyToken } from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/send-code', sendCode);
router.post('/verify-code', verifyCode);
router.get('/verify-token', verifyToken);

export default router;
