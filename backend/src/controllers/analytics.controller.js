import OrderModel from '../models/order.model.js';
import ProductModel from '../models/product.model.js';
import CategoryModel from '../models/category.model.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import { ApiError } from '../lib/ApiError.js';
import { isFeatureEnabled } from '../lib/siteSettings.js';

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
        channelAgg,
        posDailyAgg,
        sellerAgg,
        posTypeAgg,
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
        // Channel split: e-commerce vs POS (revenue + order count).
        OrderModel.aggregate([
            { $match: REVENUE_STATUSES },
            {
                $group: {
                    _id: { $ifNull: ['$source', 'ecommerce'] },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                },
            },
        ]),
        // POS-only daily series for the selected range.
        OrderModel.aggregate([
            { $match: { ...REVENUE_STATUSES, source: 'pos', createdAt: { $gte: since } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    orders: { $sum: 1 },
                    revenue: { $sum: '$totalAmount' },
                },
            },
        ]),
        // POS seller leaderboard.
        OrderModel.aggregate([
            { $match: { ...REVENUE_STATUSES, source: 'pos' } },
            {
                $group: {
                    _id: { id: '$soldBy.id', username: '$soldBy.username', fullName: '$soldBy.fullName' },
                    revenue: { $sum: '$totalAmount' },
                    orders: { $sum: 1 },
                },
            },
            { $sort: { revenue: -1 } },
            { $limit: 8 },
        ]),
        // POS retail vs wholesale split.
        OrderModel.aggregate([
            { $match: { ...REVENUE_STATUSES, source: 'pos' } },
            { $group: { _id: '$saleType', revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
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

    // --- POS / channel breakdown -------------------------------------
    const channel = { ecommerce: { revenue: 0, orders: 0 }, pos: { revenue: 0, orders: 0 } };
    for (const row of channelAgg) {
        const key = row._id === 'pos' ? 'pos' : 'ecommerce';
        channel[key] = { revenue: Math.round(row.revenue || 0), orders: row.orders || 0 };
    }

    // Zero-filled POS daily series (aligned with the e-commerce `series`).
    const posByDay = Object.fromEntries(posDailyAgg.map((d) => [d._id, d]));
    const posSeries = [];
    for (let i = 0; i < days; i += 1) {
        const date = ymd(new Date(since.getTime() + i * 86400000));
        const hit = posByDay[date];
        posSeries.push({ date, orders: hit?.orders || 0, revenue: Math.round(hit?.revenue || 0) });
    }

    const posByType = { retail: { revenue: 0, orders: 0 }, wholesale: { revenue: 0, orders: 0 } };
    for (const row of posTypeAgg) {
        const key = row._id === 'wholesale' ? 'wholesale' : 'retail';
        posByType[key] = { revenue: Math.round(row.revenue || 0), orders: row.orders || 0 };
    }

    const sellers = sellerAgg
        .filter((s) => s._id?.id)
        .map((s) => ({
            id: s._id.id,
            name: s._id.fullName || s._id.username || 'Unknown',
            username: s._id.username || '',
            revenue: Math.round(s.revenue || 0),
            orders: s.orders || 0,
        }));

    // --- Cost / profit / margin (gated by the profitReporting feature) -------
    // Computed from the per-line cost snapshot (items.costPrice) captured at sale
    // time, so it's consistent with the dedicated Profit report. Covers the same
    // all-time revenue scope as the headline cards. `null` when the feature is off
    // so the frontend simply omits the profit widgets.
    let profit = null;
    if (await isFeatureEnabled('profitReporting', true)) {
        const round2 = (n) => Math.round((n || 0) * 100) / 100;
        const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
        const costExpr = { $multiply: ['$items.quantity', { $ifNull: ['$items.costPrice', 0] }] };

        const [profitAgg, profitChannelAgg, discountAgg] = await Promise.all([
            OrderModel.aggregate([
                { $match: REVENUE_STATUSES },
                { $unwind: '$items' },
                { $group: { _id: null, revenue: { $sum: '$items.totalPrice' }, cost: { $sum: costExpr } } },
            ]),
            OrderModel.aggregate([
                { $match: REVENUE_STATUSES },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: { $cond: [{ $eq: ['$source', 'pos'] }, 'pos', 'ecommerce'] },
                        revenue: { $sum: '$items.totalPrice' },
                        cost: { $sum: costExpr },
                    },
                },
            ]),
            OrderModel.aggregate([
                { $match: REVENUE_STATUSES },
                { $group: { _id: null, discounts: { $sum: '$discount' } } },
            ]),
        ]);

        const pRevenue = round2(profitAgg[0]?.revenue);
        const pCost = round2(profitAgg[0]?.cost);
        const grossProfit = round2(pRevenue - pCost);
        const discounts = round2(discountAgg[0]?.discounts);
        const netProfit = round2(grossProfit - discounts);

        const profitChannels = {
            ecommerce: { revenue: 0, cost: 0, profit: 0, margin: 0 },
            pos: { revenue: 0, cost: 0, profit: 0, margin: 0 },
        };
        for (const row of profitChannelAgg) {
            const key = row._id === 'pos' ? 'pos' : 'ecommerce';
            const r = round2(row.revenue);
            const c = round2(row.cost);
            profitChannels[key] = { revenue: r, cost: c, profit: round2(r - c), margin: pct(r - c, r) };
        }

        profit = {
            revenue: pRevenue,
            cost: pCost,
            grossProfit,
            discounts,
            netProfit,
            margin: pct(grossProfit, pRevenue),
            channels: profitChannels,
        };
    }

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
        pos: {
            channel,
            byType: posByType,
            series: posSeries,
            sellers,
        },
        profit,
    });
});

// GET /api/admin/analytics/profit?days=30&channel=all|pos|ecommerce
// Cost / profit / margin reporting. Profit is computed from the per-line cost
// snapshot captured at sale time (order.items.costPrice) vs the line revenue.
// Gated by the admin-toggleable `profitReporting` feature flag.
export const getProfitReport = asyncHandler(async (req, res) => {
    const enabled = await isFeatureEnabled('profitReporting', true);
    if (!enabled) throw ApiError.forbidden('Profit reporting is disabled in site settings');

    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 7), 365);
    const channel = ['pos', 'ecommerce'].includes(req.query.channel) ? req.query.channel : 'all';

    const now = new Date();
    const since = startOfDay(new Date(now.getTime() - (days - 1) * 86400000));

    // Exclude cancelled/failed/returned; optionally scope to one channel.
    const baseMatch = { ...REVENUE_STATUSES, createdAt: { $gte: since } };
    if (channel === 'pos') baseMatch.source = 'pos';
    else if (channel === 'ecommerce') baseMatch.source = { $ne: 'pos' };

    // COGS = quantity × per-line cost snapshot (0 when no cost recorded).
    const costExpr = { $multiply: ['$items.quantity', { $ifNull: ['$items.costPrice', 0] }] };

    const [itemAgg, dailyAgg, productAgg, channelAgg, orderAgg] = await Promise.all([
        OrderModel.aggregate([
            { $match: baseMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: null,
                    revenue: { $sum: '$items.totalPrice' },
                    cost: { $sum: costExpr },
                    units: { $sum: '$items.quantity' },
                },
            },
        ]),
        OrderModel.aggregate([
            { $match: baseMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$items.totalPrice' },
                    cost: { $sum: costExpr },
                },
            },
        ]),
        OrderModel.aggregate([
            { $match: baseMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    revenue: { $sum: '$items.totalPrice' },
                    cost: { $sum: costExpr },
                    qty: { $sum: '$items.quantity' },
                    image: { $first: '$items.productImage' },
                },
            },
        ]),
        OrderModel.aggregate([
            { $match: baseMatch },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { $cond: [{ $eq: ['$source', 'pos'] }, 'pos', 'ecommerce'] },
                    revenue: { $sum: '$items.totalPrice' },
                    cost: { $sum: costExpr },
                },
            },
        ]),
        // Order-level totals (not unwound) for counts + coupon discounts.
        OrderModel.aggregate([
            { $match: baseMatch },
            { $group: { _id: null, orders: { $sum: 1 }, discounts: { $sum: '$discount' } } },
        ]),
    ]);

    const round2 = (n) => Math.round((n || 0) * 100) / 100;
    const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

    const revenue = round2(itemAgg[0]?.revenue);
    const cost = round2(itemAgg[0]?.cost);
    const grossProfit = round2(revenue - cost);
    const units = itemAgg[0]?.units || 0;
    const orders = orderAgg[0]?.orders || 0;
    const discounts = round2(orderAgg[0]?.discounts);
    const netProfit = round2(grossProfit - discounts);

    // Zero-fill the daily series so the chart line is continuous.
    const byDay = Object.fromEntries(dailyAgg.map((d) => [d._id, d]));
    const series = [];
    for (let i = 0; i < days; i += 1) {
        const date = ymd(new Date(since.getTime() + i * 86400000));
        const hit = byDay[date];
        const r = round2(hit?.revenue);
        const c = round2(hit?.cost);
        series.push({ date, revenue: r, cost: c, profit: round2(r - c) });
    }

    const topProducts = productAgg
        .map((p) => {
            const r = round2(p.revenue);
            const c = round2(p.cost);
            return {
                name: p._id || 'Unknown',
                qty: p.qty,
                revenue: r,
                cost: c,
                profit: round2(r - c),
                margin: pct(r - c, r),
                image: p.image || '',
            };
        })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 10);

    const channels = {
        ecommerce: { revenue: 0, cost: 0, profit: 0 },
        pos: { revenue: 0, cost: 0, profit: 0 },
    };
    for (const row of channelAgg) {
        const key = row._id === 'pos' ? 'pos' : 'ecommerce';
        const r = round2(row.revenue);
        const c = round2(row.cost);
        channels[key] = { revenue: r, cost: c, profit: round2(r - c) };
    }

    return ok(res, {
        days,
        channel,
        summary: {
            revenue,
            cost,
            grossProfit,
            margin: pct(grossProfit, revenue),
            discounts,
            netProfit,
            orders,
            units,
        },
        series,
        topProducts,
        channels,
    }, 'Profit report');
});
