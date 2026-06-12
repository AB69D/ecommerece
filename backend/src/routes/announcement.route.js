import { Router } from 'express';
import { getMyAnnouncements } from '../controllers/announcement.controller.js';

// Store-side, read-only: the active platform notices for the signed-in store.
// Mounted under requireAuth so it's scoped to the caller's store.
const router = Router();
router.get('/', getMyAnnouncements);

export default router;
