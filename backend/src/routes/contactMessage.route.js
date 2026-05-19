import express from 'express';
import { submitContactMessage, getAllContactMessages, deleteContactMessage } from '../controllers/contactMessage.controller.js';

const router = express.Router();

router.post('/submit', submitContactMessage);
router.get('/messages', getAllContactMessages);
router.delete('/delete/:id', deleteContactMessage);

export default router;
