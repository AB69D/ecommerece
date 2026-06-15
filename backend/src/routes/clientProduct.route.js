import { Router } from 'express';
import mongoose from 'mongoose';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import { tenantAggregate, tenantMatchStage } from '../tenancy/tenantAggregate.js';

const clientProductRouter = Router();

// Escape user input before using it in a $regex so search text like "a+b" or a
// stray "(" can't throw an invalid-regex error or build a pathological pattern.
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Storefront slug for a category name: "Fresh Fruit" -> "fresh-fruit". Mirrors
// how the frontend builds category links, so a slug from the URL resolves back
// to the right category id.
const slugifyCategory = (s) => String(s || '').toLowerCase().trim().replace(/\s+/g, '-');

// Whitelisted sort modes -> Mongo sort spec. Anything unknown falls back to
// newest so a bad ?sort= value can't break the query.
const PRODUCT_SORTS = {
    newest: { createdAt: -1 },
    price_asc: { effectivePrice: 1, createdAt: -1 },
    price_desc: { effectivePrice: -1, createdAt: -1 },
    name: { firstName: 1, createdAt: -1 },
};

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

        // Storefront only: hide POS-only products ($ne:false also keeps legacy
        // products where the field was never set).
        query.showInEcommerce = { $ne: false };

        const skip = (pageNum - 1) * limitNum;

        const [data, totalCount] = await Promise.all([
            // Strip costPrice (internal margin data) from the public payload.
            ProductModel.find(query).select('-weights.costPrice').sort({ createdAt: -1 }).skip(skip).limit(limitNum).populate('category'),
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

        // Storefront only: a POS-only product must 404 here even via direct link.
        const product = await ProductModel.findOne({
            _id: id,
            showInEcommerce: { $ne: false }
        }).select('-weights.costPrice').populate('category');

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

        const topSelling = await tenantAggregate(OrderModel, [
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
            _id: { $in: productIds },
            showInEcommerce: { $ne: false }
        }).select('-weights.costPrice').populate('category');

        const productsWithSales = products.map(product => {
            const salesData = topSelling.find(item => String(item._id) === String(product._id));
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

// Rich storefront search / browse: text search, category filter, price-range
// filter, in-stock filter, sort, and pagination — all server-side (the old
// storefront fetched 50 products and filtered in the browser, which neither
// scales nor searches the whole catalogue).
//
// Price + discount live per-variant inside weights[], so we compute a top-level
// effectivePrice (the lowest discounted variant price — the "from" price) in an
// aggregation and filter / sort on that. A $facet returns the page, the matched
// total, and the price bounds (to seed a range slider) in one round-trip.
clientProductRouter.get('/search', async (req, res) => {
    try {
        const { q, category, sort, inStock } = req.query;

        const pageNum = Math.max(1, parseInt(req.query.page) || 1);
        const limitNum = Math.min(48, Math.max(1, parseInt(req.query.limit) || 12));
        const skip = (pageNum - 1) * limitNum;
        const sortKey = PRODUCT_SORTS[sort] ? sort : 'newest';

        // ---- resolve category (accepts an ObjectId or a name-slug) ----
        let categoryId = null;
        let categoryNotFound = false;
        const rawCategory = String(category || '').trim();
        if (rawCategory) {
            if (mongoose.isValidObjectId(rawCategory)) {
                categoryId = new mongoose.Types.ObjectId(rawCategory);
            } else {
                const slug = slugifyCategory(rawCategory);
                const cats = await CategoryModel.find().select('category_name').lean();
                const match = cats.find((c) => slugifyCategory(c.category_name) === slug);
                if (match) categoryId = match._id;
                else categoryNotFound = true;
            }
        }

        // A category was named but doesn't exist -> empty result, skip the query.
        if (categoryNotFound) {
            return res.json({
                message: 'Product data', error: false, success: true,
                data: [], totalCount: 0, totalNoPage: 0, page: pageNum,
                priceBounds: { min: 0, max: 0 }, appliedSort: sortKey,
            });
        }

        // ---- base match (visibility + tenant + text + category) ----
        // aggregate() bypasses tenantPlugin — tenantMatchStage injects the filter
        // inline so it combines with the other conditions in one $match stage.
        const baseMatch = { showInEcommerce: { $ne: false }, ...tenantMatchStage(req.tenant?._id) };
        const text = String(q || '').trim().slice(0, 100);
        if (text) {
            const rx = new RegExp(escapeRegex(text), 'i');
            baseMatch.$or = [{ firstName: rx }, { lastName: rx }, { description: rx }];
        }
        if (categoryId) baseMatch.category = categoryId;

        // ---- price / stock match (applied after effectivePrice is computed) ----
        const priceMatch = {};
        const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== '' ? Number(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : null;
        if (Number.isFinite(minPrice)) priceMatch.effectivePrice = { ...(priceMatch.effectivePrice || {}), $gte: minPrice };
        if (Number.isFinite(maxPrice)) priceMatch.effectivePrice = { ...(priceMatch.effectivePrice || {}), $lte: maxPrice };
        if (String(inStock) === 'true') priceMatch.totalStock = { $gt: 0 };

        const pipeline = [
            { $match: baseMatch },
            {
                $addFields: {
                    // Lowest discounted variant price = the storefront "from" price.
                    effectivePrice: {
                        $min: {
                            $map: {
                                input: { $ifNull: ['$weights', []] },
                                as: 'w',
                                in: {
                                    $multiply: [
                                        { $ifNull: ['$$w.price', 0] },
                                        { $subtract: [1, { $divide: [{ $ifNull: ['$$w.discountPercent', 0] }, 100] }] },
                                    ],
                                },
                            },
                        },
                    },
                    totalStock: { $sum: { $ifNull: ['$weights.stock', []] } },
                },
            },
            {
                $facet: {
                    // The page itself. costPrice is internal margin data — strip it
                    // from the public payload (the legacy endpoints still leak it; a
                    // follow-up cleans those up).
                    data: [
                        { $match: priceMatch },
                        { $sort: PRODUCT_SORTS[sortKey] },
                        { $skip: skip },
                        { $limit: limitNum },
                        { $project: { 'weights.costPrice': 0 } },
                    ],
                    total: [{ $match: priceMatch }, { $count: 'n' }],
                    // Full price range for the current search/category context
                    // (deliberately ignores the price filter so the slider keeps
                    // its full span while the user drags it).
                    bounds: [{ $group: { _id: null, min: { $min: '$effectivePrice' }, max: { $max: '$effectivePrice' } } }],
                },
            },
        ];

        const [agg] = await ProductModel.aggregate(pipeline);
        const rawData = agg?.data || [];
        const totalCount = agg?.total?.[0]?.n || 0;
        const bounds = agg?.bounds?.[0] || { min: 0, max: 0 };

        // Populate category on just this page of results — reuses the schema ref
        // (no fragile collection-name coupling inside the pipeline).
        const data = await ProductModel.populate(rawData, { path: 'category' });

        return res.json({
            message: 'Product data',
            error: false,
            success: true,
            data,
            totalCount,
            totalNoPage: Math.ceil(totalCount / limitNum),
            page: pageNum,
            priceBounds: {
                min: Math.floor(bounds.min ?? 0),
                max: Math.ceil(bounds.max ?? 0),
            },
            appliedSort: sortKey,
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false,
        });
    }
});

// Lightweight autocomplete for the storefront search box: the few best
// name-matches for a query, with just enough fields to render a suggestion row
// (no heavy aggregation, no costPrice). Two-character minimum keeps it cheap.
clientProductRouter.get('/suggest', async (req, res) => {
    try {
        const text = String(req.query.q || '').trim().slice(0, 80);
        const limitNum = Math.min(10, Math.max(1, parseInt(req.query.limit) || 6));

        if (text.length < 2) {
            return res.json({ message: 'Suggestions', error: false, success: true, data: [] });
        }

        const rx = new RegExp(escapeRegex(text), 'i');
        const data = await ProductModel.find({
            showInEcommerce: { $ne: false },
            $or: [{ firstName: rx }, { lastName: rx }],
        })
            .select('firstName lastName cover_image weights.price weights.discountPercent')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .lean();

        return res.json({ message: 'Suggestions', error: false, success: true, data });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false,
        });
    }
});

export default clientProductRouter;