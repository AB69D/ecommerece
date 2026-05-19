import ReviewModel from "../models/review.model.js";

export const createReview = async (request, response) => {
    try {
        const { name, rating, comment, media } = request.body;

        if (!name || !rating || !comment) {
            return response.status(400).json({
                message: "Name, rating, and comment are required",
                error: true,
                success: false
            });
        }

        if (rating < 1 || rating > 5) {
            return response.status(400).json({
                message: "Rating must be between 1 and 5",
                error: true,
                success: false
            });
        }

        const parsedMedia = media ? (typeof media === 'string' ? JSON.parse(media) : media) : [];
        const review = new ReviewModel({ name, rating, comment, media: parsedMedia });
        await review.save();

        return response.status(201).json({
            message: "Review created successfully",
            error: false,
            success: true,
            data: review
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const getAllReviews = async (request, response) => {
    try {
        const reviews = await ReviewModel.find().sort({ createdAt: -1 });

        return response.json({
            message: "Reviews fetched successfully",
            error: false,
            success: true,
            data: reviews
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const deleteReview = async (request, response) => {
    try {
        const { id } = request.params;

        const deletedReview = await ReviewModel.findByIdAndDelete(id);

        if (!deletedReview) {
            return response.status(404).json({
                message: "Review not found",
                error: true,
                success: false
            });
        }

        return response.json({
            message: "Review deleted successfully",
            error: false,
            success: true
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};
