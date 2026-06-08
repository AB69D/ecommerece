import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import ReviewModel from '../models/review.model.js';

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed'), false);
        }
    }
});

const uploadToCloudinary = async (file) => {
    const isVideo = file.mimetype.startsWith('video/');

    if (isVideo) {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: "Ab9dEcommerce/reviews",
                    resource_type: "video",
                    eager: [{ streaming_profile: "hd", format: "m3u8" }],
                    eager_async: true
                },
                (error, result) => {
                    if (result) resolve({ type: 'video', url: result.secure_url });
                    else reject(error);
                }
            );
            stream.end(file.buffer);
        });
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "Ab9dEcommerce/reviews", format: "webp" },
            (error, result) => {
                if (result) resolve({ type: 'image', url: result.secure_url });
                else reject(error);
            }
        );
        stream.end(file.buffer);
    });
};

const clientReviewRouter = Router();

clientReviewRouter.post('/create', upload.array('media', 5), async (req, res) => {
    try {
        const { name, rating, comment, productId } = req.body;

        if (!name || !rating || !comment) {
            return res.status(400).json({
                message: "Name, rating, and comment are required",
                error: true,
                success: false
            });
        }

        const numericRating = Number(rating);
        if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
            return res.status(400).json({
                message: "Rating must be between 1 and 5",
                error: true,
                success: false
            });
        }

        // productId is optional; only attach it when it is a valid ObjectId so a
        // malformed value can never break review submission.
        let product = null;
        if (productId && mongoose.Types.ObjectId.isValid(productId)) {
            product = productId;
        }

        let media = [];
        if (req.files && req.files.length > 0) {
            const uploads = await Promise.all(req.files.map(uploadToCloudinary));
            media = uploads;
        }

        const review = new ReviewModel({ name, rating: numericRating, comment, media, product });
        await review.save();

        return res.status(201).json({
            message: "Review submitted successfully",
            error: false,
            success: true,
            data: review
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

// Reviews + rating summary for a single product (used on the product detail page).
clientReviewRouter.get('/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({
                message: "Invalid product id",
                error: true,
                success: false
            });
        }

        const objectId = new mongoose.Types.ObjectId(productId);
        const reviews = await ReviewModel.find({ product: objectId }).sort({ createdAt: -1 });

        const count = reviews.length;
        const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
        const average = count > 0 ? sum / count : 0;
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        reviews.forEach((r) => {
            const k = Math.round(r.rating);
            if (distribution[k] !== undefined) distribution[k] += 1;
        });

        return res.json({
            message: "Product reviews fetched successfully",
            error: false,
            success: true,
            data: {
                productId,
                average: Math.round(average * 10) / 10,
                count,
                distribution,
                reviews
            }
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

// Bulk rating summary for many products at once (used by product cards/grids).
// GET /summary?productIds=id1,id2,id3
clientReviewRouter.get('/summary', async (req, res) => {
    try {
        const raw = (req.query.productIds || '').toString();
        const ids = raw
            .split(',')
            .map((s) => s.trim())
            .filter((s) => mongoose.Types.ObjectId.isValid(s));

        if (ids.length === 0) {
            return res.json({
                message: "No valid product ids",
                error: false,
                success: true,
                data: {}
            });
        }

        const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
        const rows = await ReviewModel.aggregate([
            { $match: { product: { $in: objectIds } } },
            { $group: { _id: '$product', average: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const summary = {};
        rows.forEach((row) => {
            summary[row._id.toString()] = {
                average: Math.round((row.average || 0) * 10) / 10,
                count: row.count
            };
        });

        return res.json({
            message: "Rating summary fetched successfully",
            error: false,
            success: true,
            data: summary
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

clientReviewRouter.get('/reviews', async (req, res) => {
    try {
        const reviews = await ReviewModel.find().sort({ createdAt: -1 });

        return res.json({
            message: "Reviews fetched successfully",
            error: false,
            success: true,
            data: reviews
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

export default clientReviewRouter;
