import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import OrderModel from '../models/order.model.js';
import CheckoutLeadModel from '../models/checkoutLead.model.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Customers who have placed at least one order, grouped by phone number.
export const getOrderedCustomers = asyncHandler(async (req, res) => {
    const search = (req.query.search || '').toString().trim();

    const match = {};
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        match.$or = [
            { customerName: rx },
            { customerPhone: rx },
            { customerEmail: rx }
        ];
    }

    const pipeline = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });
    pipeline.push(
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: '$customerPhone',
                customerName: { $first: '$customerName' },
                customerEmail: { $first: '$customerEmail' },
                lastAddress: { $first: '$shippingAddress' },
                lastOrderDate: { $max: '$createdAt' },
                firstOrderDate: { $min: '$createdAt' },
                totalOrders: { $sum: 1 },
                deliveredOrders: {
                    $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] }
                },
                cancelledOrders: {
                    $sum: { $cond: [{ $in: ['$orderStatus', ['cancelled', 'failed']] }, 1, 0] }
                },
                totalSpent: {
                    $sum: {
                        $cond: [{ $in: ['$orderStatus', ['cancelled', 'failed']] }, 0, '$totalAmount']
                    }
                }
            }
        },
        { $sort: { lastOrderDate: -1 } },
        { $limit: 500 }
    );

    const rows = await OrderModel.aggregate(pipeline);

    const customers = rows.map((r) => ({
        phone: r._id,
        name: r.customerName || 'Unknown',
        email: r.customerEmail || '',
        address: r.lastAddress || '',
        totalOrders: r.totalOrders,
        deliveredOrders: r.deliveredOrders,
        cancelledOrders: r.cancelledOrders,
        totalSpent: Math.round((r.totalSpent || 0) * 100) / 100,
        firstOrderDate: r.firstOrderDate,
        lastOrderDate: r.lastOrderDate
    }));

    return ok(res, customers, 'Ordered customers fetched');
});

// Customers who started the checkout form but never placed the order.
export const getAbandonedLeads = asyncHandler(async (req, res) => {
    const search = (req.query.search || '').toString().trim();

    const query = { status: 'abandoned' };
    if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        query.$or = [
            { customerName: rx },
            { customerPhone: rx },
            { customerEmail: rx }
        ];
    }

    const leads = await CheckoutLeadModel.find(query)
        .sort({ lastActivityAt: -1 })
        .limit(500)
        .lean();

    return ok(res, leads, 'Abandoned checkouts fetched');
});

// Headline counts for the Customers page tabs.
export const getCustomerStats = asyncHandler(async (req, res) => {
    const [orderedAgg, abandonedCount, recoveryAgg] = await Promise.all([
        OrderModel.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId) } },
            { $group: { _id: '$customerPhone' } },
            { $count: 'count' }
        ]),
        CheckoutLeadModel.countDocuments({ tenantId: new mongoose.Types.ObjectId(req.tenantId), status: 'abandoned' }),
        CheckoutLeadModel.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId) } },
            { $group: { _id: null, total: { $sum: '$recoveryAttempts' } } }
        ])
    ]);

    return ok(res, {
        orderedCustomers: orderedAgg[0]?.count || 0,
        abandonedCheckouts: abandonedCount,
        totalRecoveryMessages: recoveryAgg[0]?.total || 0,
    }, 'Customer stats fetched');
});
