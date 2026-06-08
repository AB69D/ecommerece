import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../utils/validate.js';
import { chatMessageSchema } from '../validations/chatbot.schema.js';
import { postChatMessage } from '../controllers/chatbot.controller.js';

const chatbotRouter = Router();

// Public endpoint — keep a tighter per-IP limit on top of the global API limit
// since each turn runs database queries.
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'You are sending messages too quickly. Please wait a moment.' },
});

chatbotRouter.post('/message', chatLimiter, validate({ body: chatMessageSchema }), postChatMessage);

export default chatbotRouter;
