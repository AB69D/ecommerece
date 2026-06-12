import { Router } from 'express';
import { getMyBilling } from '../controllers/billing.controller.js';

// A store's view of its OWN plan, usage and balance. Read-only; mounted under
// requireAuth so it's scoped to the signed-in store.
const router = Router();
router.get('/', getMyBilling);

export default router;
