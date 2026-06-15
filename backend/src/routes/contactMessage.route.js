import express from 'express';
import requireAuth, { requirePermission } from '../middlewares/auth.middleware.js';
import { submitContactMessage, getAllContactMessages, deleteContactMessage } from '../controllers/contactMessage.controller.js';

const router = express.Router();

router.post('/submit', submitContactMessage);
router.get('/messages', requireAuth, requirePermission('content:read'), getAllContactMessages);
router.delete('/delete/:id', requireAuth, requirePermission('content:delete'), deleteContactMessage);

export default router;
