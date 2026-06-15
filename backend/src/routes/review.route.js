import express from 'express';
import { createReview, getAllReviews, deleteReview, approveReview, rejectReview } from '../controllers/review.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/create', requirePermission('review:write'), createReview);
router.get('/all', requirePermission('review:read'), getAllReviews);
router.patch('/approve/:id', requirePermission('review:write'), approveReview);
router.patch('/reject/:id', requirePermission('review:write'), rejectReview);
router.delete('/delete/:id', requirePermission('review:delete'), deleteReview);

export default router;
