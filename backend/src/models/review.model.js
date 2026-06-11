import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['image', 'video'],
        required: true
    },
    url: {
        type: String,
        required: true
    }
}, { _id: false });

const reviewSchema = new mongoose.Schema({
    // Optional link to a specific product. When present, the review is shown on
    // that product's page and counts toward its star rating. When absent, the
    // review is a general/site review (e.g. submitted from the order-tracking
    // page) and only appears in the homepage testimonial carousel.
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'product',
        default: null,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        required: true,
        trim: true
    },
    media: [mediaSchema]
}, {
    timestamps: true
});

// The homepage testimonials carousel and the admin list both read newest-first;
// this index backs that sort so it doesn't scan the whole collection as reviews
// accumulate.
reviewSchema.index({ createdAt: -1 });

const ReviewModel = mongoose.model('review', reviewSchema);

export default ReviewModel;
