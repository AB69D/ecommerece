import ProductModel from "../models/product.model.js";
import CategoryModel from "../models/category.model.js";
import mongoose from "mongoose";

export const createProductController = async (request, response) => {
    try {
        const {
            firstName,
            lastName,
            category,
            weights,
            description,
            qa
        } = request.body;

        const files = request.files || {};
        const coverImageFile = files['cover_image'];
        const cover_image = coverImageFile ? (Array.isArray(coverImageFile) ? coverImageFile[0]?.path : coverImageFile.path) : "";

        if (!firstName || !category || !weights) {
            return response.status(400).json({
                message: "Enter required fields (firstName, category, weights)",
                error: true,
                success: false
            });
        }

        let categoryId = category;
        if (typeof category === 'string') {
            if (mongoose.Types.ObjectId.isValid(category)) {
                categoryId = category;
            } else {
                const foundCat = await CategoryModel.findOne({ category_name: category });
                if (!foundCat) {
                    return response.status(400).json({
                        message: `Category not found: ${category}`,
                        error: true,
                        success: false
                    });
                }
                categoryId = foundCat._id;
            }
        }

        let weightsArray = [];
        try {
            weightsArray = typeof weights === 'string' ? JSON.parse(weights) : weights;
        } catch (error) {
            return response.status(400).json({
                message: "Invalid weights format",
                error: true,
                success: false
            });
        }

        const processedWeights = weightsArray.map((weightObj, index) => {
            const fieldKey = `weight_images_${index}`;
            const weightImageFiles = files[fieldKey];
            let weightImages = [];
            
            if (weightImageFiles) {
                weightImages = Array.isArray(weightImageFiles) 
                    ? weightImageFiles.map(f => f.path)
                    : [weightImageFiles.path];
            }

            return {
                weight: weightObj.weight,
                stock: weightObj.stock,
                price: weightObj.price,
                images: weightImages
            };
        });

        let qaArray = [];
        try {
            qaArray = typeof qa === 'string' ? JSON.parse(qa) : (qa || []);
        } catch (error) {
            qaArray = [];
        }

        const product = new ProductModel({
            cover_image,
            firstName,
            lastName: lastName || "",
            category: categoryId,
            weights: processedWeights,
            description: description || "",
            qa: qaArray
        });

        const saveProduct = await product.save();

        return response.json({
            message: "Product Created Successfully",
            data: saveProduct,
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

export const getProductController = async (request, response) => {
    try {
        let { page, limit, search } = request.body;

        if (!page) page = 1;
        if (!limit) limit = 10;

        const query = search ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const skip = (page - 1) * limit;

        const [data, totalCount] = await Promise.all([
            ProductModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('category'),
            ProductModel.countDocuments(query)
        ]);

        return response.json({
            message: "Product data",
            error: false,
            success: true,
            totalCount: totalCount,
            totalNoPage: Math.ceil(totalCount / limit),
            data: data
        });
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const getProductByCategory = async (request, response) => {
    try {
        const { id } = request.body;

        if (!id) {
            return response.status(400).json({
                message: "provide category id",
                error: true,
                success: false
            });
        }

        const product = await ProductModel.find({
            category: { $in: id }
        }).limit(15);

        return response.json({
            message: "category product list",
            data: product,
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

export const getProductDetails = async (request, response) => {
    try {
        const { productId } = request.body;

        const product = await ProductModel.findOne({ _id: productId }).populate('category');

        return response.json({
            message: "product details",
            data: product,
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

export const updateProductDetails = async (request, response) => {
    try {
        const { _id } = request.body;

        if (!_id) {
            return response.status(400).json({
                message: "provide product _id",
                error: true,
                success: false
            });
        }

        const updateData = { ...request.body };
        delete updateData._id;

        const updateProduct = await ProductModel.updateOne({ _id: _id }, updateData);

        return response.json({
            message: "updated successfully",
            data: updateProduct,
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

export const deleteProductDetails = async (request, response) => {
    try {
        const { _id } = request.body;

        if (!_id) {
            return response.status(400).json({
                message: "provide _id ",
                error: true,
                success: false
            });
        }

        const deleteProduct = await ProductModel.deleteOne({ _id: _id });

        return response.json({
            message: "Delete successfully",
            error: false,
            success: true,
            data: deleteProduct
        });
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const updateProductDiscount = async (request, response) => {
    try {
        const { productId, weightIndex, discountPercent } = request.body;

        if (!productId) {
            return response.status(400).json({
                message: "provide productId",
                error: true,
                success: false
            });
        }

        const product = await ProductModel.findById(productId);
        if (!product) {
            return response.status(404).json({
                message: "Product not found",
                error: true,
                success: false
            });
        }

        if (weightIndex !== undefined && product.weights[weightIndex]) {
            product.weights[weightIndex].discountPercent = discountPercent || 0;
            await product.save();
        }

        return response.json({
            message: "Discount updated successfully",
            data: product,
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

export const searchProduct = async (request, response) => {
    try {
        let { search, page, limit } = request.body;

        if (!page) page = 1;
        if (!limit) limit = 10;

        const query = search ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } }
            ]
        } : {};

        const skip = (page - 1) * limit;

        const [data, dataCount] = await Promise.all([
            ProductModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('category'),
            ProductModel.countDocuments(query)
        ]);

        return response.json({
            message: "Product data",
            error: false,
            success: true,
            data: data,
            totalCount: dataCount,
            totalPage: Math.ceil(dataCount / limit),
            page: page,
            limit: limit
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const getTopSellingProducts = async (request, response) => {
    try {
        const { limit } = request.query;
        const limitNum = limit ? parseInt(limit) : 20;

        const topSelling = await OrderModel.aggregate([
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productId',
                    totalSold: { $sum: '$items.quantity' }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: limitNum }
        ]);

        const productIds = topSelling.map(item => item._id);

        const products = await ProductModel.find({
            _id: { $in: productIds }
        }).populate('category');

        const productsWithSales = products.map(product => {
            const salesData = topSelling.find(item => item._id === product._id.toString());
            return {
                ...product.toObject(),
                totalSold: salesData ? salesData.totalSold : 0
            };
        });

        productsWithSales.sort((a, b) => b.totalSold - a.totalSold);

        return response.json({
            message: "Top selling products",
            error: false,
            success: true,
            data: productsWithSales
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};