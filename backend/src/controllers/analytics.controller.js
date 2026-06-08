import OrderModel from '../models/order.model.js';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';

const REVENUE_STATUSES = { orderStatus: { $nin: ['cancelled', 'failed', 'returned'] } };
const LOW_STOCK_THRESHOLD = 5;

const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

const ymd = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// GET /api/admin/analytics/overview?days=30
// One aggregated payload that powers the whole dashboard (cards + charts).
export const getDashboardOverview = asyncHandler(async (req, res) => {
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 90);

    const now = new Date();
    const since = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));
    const last7 = new Date(now.getTime() - 7 * 86400000);
    const prev7Start = new Date(now.getTime() - 14 * 86400000);

    const [
        totalOrders,
        totalProducts,
        totalCategories,
        lowStockCount,
        revenueAgg,
        statusAgg,
        dailyAgg,
        topProductsAgg,
        last7Agg,
        prev7Agg,
    ] = await Promise.all([
        OrderModel.countDocuments(),
        ProductModel.countDocuments(),
        CategoryModel.countDocuments(),
        ProductModel.countDocuments({ 'weights.stock': { $lte: LOW_STOCK_THRESHOLD } }),
        OrderModel.aggregate([
            { $match: REVENUE_STATUSES },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
            { $group: { _id: '$orderStatus', count: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
            { $match: { createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    orders: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $in: ['$orderStatus', ['cancelled', 'failed', 'returned']] },
                                0,
                                '$totalAmount',
                            ],
                        },
                    },
                },
            },
        ]),
        OrderModel.aggregate([
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    qty: { $sum: '$items.quantity' },
                    revenue: { $sum: '$items.totalPrice' },
                    image: { $first: '$items.productImage' },
                },
            },
            { $sort: { qty: -1 } },
            { $limit: 6 },
        ]),
        OrderModel.aggregate([
            { $match: { ...REVENUE_STATUSES, createdAt: { $gte: last7 } } },
            { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        ]),
        OrderModel.aggregate([
            { $match: { ...REVENUE_STATUSES, createdAt: { $gte: prev7Start, $lt: last7 } } },
            { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
        ]),
    ]);

    // Zero-fill the daily series so the chart line is continuous.
    const byDay = Object.fromEntries(dailyAgg.map((d) => [d._id, d]));
    const series = [];
    for (let i = 0; i < days; i += 1) {
        const date = ymd(new Date(since.getTime() + i * 86400000));
        const hit = byDay[date];
        series.push({ date, orders: hit?.orders || 0, revenue: Math.round(hit?.revenue || 0) });
    }

    const totalRevenue = Math.round(revenueAgg[0]?.total || 0);
    const paidOrders = revenueAgg[0]?.count || 0;
    const last7Revenue = Math.round(last7Agg[0]?.revenue || 0);
    const prev7Revenue = Math.round(prev7Agg[0]?.revenue || 0);
    const last7Orders = last7Agg[0]?.orders || 0;
    const prev7Orders = prev7Agg[0]?.orders || 0;

    const growth = (cur, prev) => {
        if (!prev) return cur > 0 ? 100 : 0;
        return Math.round(((cur - prev) / prev) * 1000) / 10;
    };

    return ok(res, {
        summary: {
            totalOrders,
            totalRevenue,
            totalProducts,
            totalCategories,
            lowStockCount,
            avgOrderValue: paidOrders ? Math.round(totalRevenue / paidOrders) : 0,
            last7Revenue,
            last7Orders,
            revenueGrowth: growth(last7Revenue, prev7Revenue),
            ordersGrowth: growth(last7Orders, prev7Orders),
        },
        ordersByStatus: statusAgg.map((s) => ({ status: s._id || 'unknown', count: s.count })),
        series,
        topProducts: topProductsAgg.map((p) => ({
            name: p._id || 'Unknown',
            qty: p.qty,
            revenue: Math.round(p.revenue || 0),
            image: p.image || '',
        })),
    });
});
