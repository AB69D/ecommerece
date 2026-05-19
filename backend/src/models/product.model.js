import mongoose from "mongoose";

const weightSchema = new mongoose.Schema({
    weight: {
        type: String,
        required: true
    },
    stock: {
        type: Number,
        default: 0,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    images: {
        type: Array,
        default: []
    }
}, { _id: false });

const qaSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    answer: {
        type: String,
        required: true
    }
}, { _id: true });

const productSchema = new mongoose.Schema({
    cover_image: {
        type: String,
        default: ""
    },
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        default: ""
    },
    category: {
        type: mongoose.Schema.ObjectId,
        ref: 'category',
        required: true
    },
    weights: [weightSchema],
    description: {
        type: String,
        default: ""
    },
    qa: [qaSchema]
}, {
    timestamps: true
});

productSchema.index({
    firstName: "text",
    lastName: "text",
    description: 'text'
});

const ProductModel = mongoose.model('product', productSchema);

export default ProductModel;