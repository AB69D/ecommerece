import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { trackEvent } from '../controllers/tracking.controller.js';

const trackingRouter = Router();

// Public endpoint — a browsing session fires several events (PageView,
// ViewContent, AddToCart…), so allow a generous per-IP burst while still
// capping abuse on top of the global API limit.
const trackLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many tracking events. Please slow down.' },
});

trackingRouter.post('/', trackLimiter, trackEvent);

export default trackingRouter;
