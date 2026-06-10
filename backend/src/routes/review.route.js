import express from 'express';
import { createReview, getAllReviews, deleteReview } from '../controllers/review.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/create', requirePermission('review:write'), createReview);
router.get('/all', requirePermission('review:read'), getAllReviews);
router.delete('/delete/:id', requirePermission('review:delete'), deleteReview);

export default router;
