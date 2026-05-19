import { Router } from 'express';
import ProductModel from '../models/product.model.js';

const clientProductRouter = Router();

clientProductRouter.get('/products', async (req, res) => {
    try {
        const { page, limit, search, category } = req.query;

        const pageNum = page ? parseInt(page) : 1;
        const limitNum = limit ? parseInt(limit) : 10;

        const query = search ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } }
            ]
        } : {};

        if (category) {
            query.category = category;
        }

        const skip = (pageNum - 1) * limitNum;

        const [data, totalCount] = await Promise.all([
            ProductModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).populate('category'),
            ProductModel.countDocuments(query)
        ]);

        return res.json({
            message: "Product data",
            error: false,
            success: true,
            totalCount: totalCount,
            totalNoPage: Math.ceil(totalCount / limitNum),
            data: data
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

clientProductRouter.get('/product/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const product = await ProductModel.findById(id).populate('category');

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
                error: true,
                success: false
            });
        }

        return res.json({
            message: "Product details",
            data: product,
            error: false,
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

clientProductRouter.get('/top-selling', async (req, res) => {
    try {
        const { limit } = req.query;
        const limitNum = limit ? parseInt(limit) : 20;

        const OrderModel = (await import('../models/order.model.js')).default;

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

        return res.json({
            message: "Top selling products",
            error: false,
            success: true,
            data: productsWithSales
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
});

export default clientProductRouter;