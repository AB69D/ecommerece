import express from 'express';
import { createReview, getAllReviews, deleteReview } from '../controllers/review.controller.js';

const router = express.Router();

router.post('/create', createReview);
router.get('/all', getAllReviews);
router.delete('/delete/:id', deleteReview);

export default router;
