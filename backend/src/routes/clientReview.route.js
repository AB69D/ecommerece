import { Router } from 'express';
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
                    folder: "Gram2ghor/reviews",
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
            { folder: "Gram2ghor/reviews", format: "webp" },
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
        const { name, rating, comment } = req.body;

        if (!name || !rating || !comment) {
            return res.status(400).json({
                message: "Name, rating, and comment are required",
                error: true,
                success: false
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                message: "Rating must be between 1 and 5",
                error: true,
                success: false
            });
        }

        let media = [];
        if (req.files && req.files.length > 0) {
            const uploads = await Promise.all(req.files.map(uploadToCloudinary));
            media = uploads;
        }

        const review = new ReviewModel({ name, rating, comment, media });
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
