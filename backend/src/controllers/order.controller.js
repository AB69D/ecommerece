import mongoose from 'mongoose';
import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";
import PaymentModel from "../models/payment.model.js";
import { recordStockMovements, applyStockDeltas, actorFromReq } from "../lib/stockLedger.js";
import { sendOrderStatusEmail } from "../lib/orderEmail.js";
import { logger } from "../lib/logger.js";
import { getSettings } from "../lib/siteSettings.js";
import { notifyAdminNewOrder, notifyCustomerOrderCreated, notifyCustomerStatusChange } from "../lib/notify.js";
import { refund as sslRefund } from "../lib/sslcommerz.js";

export const createOrderController = async (request, response) => {
    try {
        const { orderId, guestId, customerName, customerPhone, customerEmail, shippingAddress, city, items, subtotal, deliveryCharge, totalAmount, paymentMethod } = request.body;

        if (!orderId || !guestId || !customerName || !customerPhone || !shippingAddress || !items || items.length === 0) {
            return response.status(400).json({
                message: "Required fields are missing",
                error: true,
                success: false
            });
        }

        const order = new OrderModel({
            orderId,
            guestId,
            customerName,
            customerPhone,
            customerEmail,
            shippingAddress,
            city,
            items,
            subtotal,
            deliveryCharge,
            totalAmount,
            paymentMethod: paymentMethod || 'cash_on_delivery'
        });

        // Stock availability guard — skip when the store explicitly allows
        // selling into negative stock (e.g. pre-order / backorder mode).
        const settings = await getSettings();
        if (!settings?.pos?.allowNegativeStock) {
            const stockableItems = items.filter((i) => i.weightIndex !== undefined);
            if (stockableItems.length > 0) {
                const productIds = [...new Set(stockableItems.map((i) => i.productId))];
                const products = await ProductModel.find({ _id: { $in: productIds } }).lean();
                const productMap = Object.fromEntries(products.map((p) => [String(p._id), p]));

                const insufficient = [];
                for (const item of stockableItems) {
                    const product = productMap[String(item.productId)];
                    const available = product?.weights?.[item.weightIndex]?.stock ?? 0;
                    if (available < item.quantity) {
                        insufficient.push({
                            productName: item.productName || item.productId,
                            weight: item.weight,
                            requested: item.quantity,
                            available,
                        });
                    }
                }

                if (insufficient.length > 0) {
                    const detail = insufficient
                        .map((i) => `${i.productName} (${i.weight}): requested ${i.requested}, available ${i.available}`)
                        .join('; ');
                    return response.status(409).json({
                        message: `Insufficient stock: ${detail}`,
                        error: true,
                        success: false,
                        insufficientItems: insufficient,
                    });
                }
            }
        }

        await order.save();

        // Admin-created order: trusted decrement, no oversell race to guard
        // against, so apply all lines in a single bulkWrite.
        await applyStockDeltas(
            items
                .filter((i) => i.weightIndex !== undefined)
                .map((i) => ({ productId: i.productId, weightIndex: i.weightIndex, delta: -i.quantity }))
        );

        await recordStockMovements(
            items.map((i) => ({
                productId: i.productId,
                productName: i.productName,
                weightIndex: i.weightIndex,
                weight: i.weight,
                delta: -i.quantity,
            })),
            { reason: 'sale', channel: 'admin', orderId, actor: actorFromReq(request) }
        );

        // Notify the store owner (admin alert) and the customer via WhatsApp.
        // Both are fire-and-forget so a failed notification never blocks the response.
        notifyAdminNewOrder(order).catch(() => {});
        notifyCustomerOrderCreated(order).catch(() => {});

        return response.json({
            message: "Order created successfully",
            data: order,
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

export const updateOrderStatusController = async (request, response) => {
    try {
        const { orderId, orderStatus } = request.body;

        if (!orderId || !orderStatus) {
            return response.status(400).json({
                message: "orderId and orderStatus are required",
                error: true,
                success: false
            });
        }

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        const previousStatus = order.orderStatus;
        order.orderStatus = orderStatus;
        await order.save();

        if (orderStatus === 'cancelled' && previousStatus !== 'cancelled') {
            // Restock is unconditional (+qty back to each line) — single bulkWrite.
            await applyStockDeltas(
                order.items
                    .filter((i) => i.weightIndex !== undefined)
                    .map((i) => ({ productId: i.productId, weightIndex: i.weightIndex, delta: i.quantity }))
            );

            await recordStockMovements(
                order.items.map((i) => ({
                    productId: i.productId,
                    productName: i.productName,
                    weightIndex: i.weightIndex,
                    weight: i.weight,
                    delta: i.quantity,
                })),
                { reason: 'cancel', channel: 'admin', orderId, actor: actorFromReq(request), note: `Order ${orderStatus}` }
            );
        }

        // Keep the customer informed when their order reaches a milestone
        // (shipped / delivered / cancelled / returned). Only on a real status
        // change — re-saving the same status shouldn't re-email — and only for
        // statuses with customer-facing copy (sendOrderStatusEmail no-ops on the
        // rest). Fire-and-forget + best-effort so it never delays or breaks the
        // admin response.
        if (previousStatus !== orderStatus) {
            sendOrderStatusEmail(order).catch((err) => logger.warn({ err }, 'Order status email failed'));
            // WhatsApp status alert — best-effort, never blocks the response.
            notifyCustomerStatusChange(order).catch(() => {});
        }

        return response.json({
            message: "Order status updated successfully",
            data: order,
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

export const getAllOrdersController = async (request, response) => {
    try {
        let { page, limit, search, status, source, soldById } = request.body;

        if (!page) page = 1;
        if (!limit) limit = 20;

        let query = {};

        if (search) {
            query.$or = [
                { orderId: { $regex: search, $options: 'i' } },
                { customerName: { $regex: search, $options: 'i' } },
                { customerPhone: { $regex: search, $options: 'i' } }
            ];
        }

        if (status && status !== 'all') {
            query.orderStatus = status;
        }

        // Channel filter: e-commerce vs POS.
        if (source && source !== 'all') {
            query.source = source;
        }

        // POS salesman filter (implies POS channel).
        if (soldById && soldById !== 'all') {
            query['soldBy.id'] = soldById;
        }

        const skip = (page - 1) * limit;

        const [data, totalCount] = await Promise.all([
            OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            OrderModel.countDocuments(query)
        ]);

        return response.json({
            message: "Orders fetched successfully",
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

export const getOrderDetailsController = async (request, response) => {
    try {
        const { orderId } = request.body;

        if (!orderId) {
            return response.status(400).json({
                message: "orderId is required",
                error: true,
                success: false
            });
        }

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        return response.json({
            message: "Order details fetched successfully",
            data: order,
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

export const getStockReportController = async (request, response) => {
    try {
        const products = await ProductModel.find().populate('category').sort({ createdAt: -1 });

        const stockReport = products.map(product => {
            let totalStock = 0;
            let totalValue = 0;

            const weightDetails = product.weights.map((w, index) => {
                const stock = w.stock || 0;
                totalStock += stock;
                totalValue += stock * w.price;
                return {
                    weight: w.weight,
                    stock: stock,
                    price: w.price,
                    weightIndex: index
                };
            });

            return {
                _id: product._id,
                productName: product.firstName + (product.lastName ? ' ' + product.lastName : ''),
                category: product.category?.category_name || 'N/A',
                coverImage: product.cover_image,
                totalStock: totalStock,
                totalValue: totalValue,
                weights: weightDetails,
                createdAt: product.createdAt
            };
        });

        const summary = {
            totalProducts: stockReport.length,
            totalItemsInStock: stockReport.reduce((sum, p) => sum + p.totalStock, 0),
            totalInventoryValue: stockReport.reduce((sum, p) => sum + p.totalValue, 0)
        };

        return response.json({
            message: "Stock report fetched successfully",
            error: false,
            success: true,
            data: stockReport,
            summary: summary
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const updateStockController = async (request, response) => {
    try {
        const { productId, weightIndex, action } = request.body;
        const quantity = parseInt(request.body.quantity, 10);

        if (!productId || weightIndex === undefined || !request.body.quantity || !action) {
            return response.status(400).json({
                message: "productId, weightIndex, quantity, and action are required",
                error: true,
                success: false
            });
        }

        if (isNaN(quantity) || quantity <= 0) {
            return response.status(400).json({
                message: "quantity must be a positive integer",
                error: true,
                success: false
            });
        }

        if (!['add', 'subtract'].includes(action)) {
            return response.status(400).json({
                message: "action must be 'add' or 'subtract'",
                error: true,
                success: false
            });
        }

        const stockChange = action === 'subtract' ? -quantity : quantity;
        const filter = { _id: productId };
        if (action === 'subtract') {
            filter[`weights.${weightIndex}.stock`] = { $gte: quantity };
        }

        const updateResult = await ProductModel.findOneAndUpdate(
            filter,
            { $inc: { [`weights.${weightIndex}.stock`]: stockChange } },
            { new: true }
        );

        if (!updateResult) {
            return response.status(400).json({ message: "Insufficient stock or product not found", error: true, success: false });
        }

        const variant = updateResult.weights[weightIndex] || {};
        const balanceAfter = variant.stock ?? 0;
        await recordStockMovements(
            [{
                productId,
                productName: `${updateResult.firstName || ''}${updateResult.lastName ? ` ${updateResult.lastName}` : ''}`.trim(),
                weightIndex: Number(weightIndex),
                weight: variant.weight || '',
                delta: stockChange,
                balanceAfter,
            }],
            { reason: 'adjustment', channel: 'admin', actor: actorFromReq(request), note: request.body.note || `Manual ${action}` }
        );

        return response.json({
            message: "Stock updated successfully",
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

export const getOrderStatsController = async (request, response) => {
    try {
        const tenantFilter = { tenantId: new mongoose.Types.ObjectId(request.tenantId) };
        const totalOrders = await OrderModel.countDocuments(tenantFilter);
        const pendingOrders = await OrderModel.countDocuments({ ...tenantFilter, orderStatus: 'pending' });
        const confirmedOrders = await OrderModel.countDocuments({ ...tenantFilter, orderStatus: 'confirmed' });
        const processingOrders = await OrderModel.countDocuments({ ...tenantFilter, orderStatus: 'processing' });
        const shippedOrders = await OrderModel.countDocuments({ ...tenantFilter, orderStatus: 'shipped' });
        const deliveredOrders = await OrderModel.countDocuments({ ...tenantFilter, orderStatus: 'delivered' });
        const cancelledOrders = await OrderModel.countDocuments({ ...tenantFilter, orderStatus: 'cancelled' });

        const totalRevenue = await OrderModel.aggregate([
            { $match: { tenantId: new mongoose.Types.ObjectId(request.tenantId), orderStatus: { $nin: ['cancelled'] } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        return response.json({
            message: "Order stats fetched successfully",
            error: false,
            success: true,
            data: {
                totalOrders,
                pendingOrders,
                confirmedOrders,
                processingOrders,
                shippedOrders,
                deliveredOrders,
                cancelledOrders,
                totalRevenue: totalRevenue[0]?.total || 0
            }
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const confirmOrderController = async (request, response) => {
    try {
        const { orderId, deliveryDate, adminNotes } = request.body;

        if (!orderId) {
            return response.status(400).json({
                message: "Order ID is required",
                error: true,
                success: false
            });
        }

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        if (order.orderStatus !== 'pending') {
            return response.status(400).json({
                message: "Order is not in pending status",
                error: true,
                success: false
            });
        }

        let returnAvailableUntil = null;
        if (deliveryDate) {
            const delivery = new Date(deliveryDate);
            returnAvailableUntil = new Date(delivery);
            returnAvailableUntil.setDate(returnAvailableUntil.getDate() + 3);
        }

        order.orderStatus = 'confirmed';
        order.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
        order.returnAvailableUntil = returnAvailableUntil;
        order.confirmedAt = new Date();
        if (adminNotes) {
            order.adminNotes = adminNotes;
        }

        await order.save();

        return response.json({
            message: "Order confirmed successfully",
            data: order,
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

export const bulkUpdateOrderStatusController = async (request, response) => {
    try {
        const { orderIds, status } = request.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return response.status(400).json({
                message: "orderIds must be a non-empty array",
                error: true,
                success: false
            });
        }

        if (orderIds.length > 100) {
            return response.status(400).json({
                message: "Cannot update more than 100 orders at once",
                error: true,
                success: false
            });
        }

        const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'return_requested'];
        if (!status || !VALID_STATUSES.includes(status)) {
            return response.status(400).json({
                message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
                error: true,
                success: false
            });
        }

        const orders = await OrderModel.find({ orderId: { $in: orderIds } });

        const failed = [];
        const toUpdate = [];

        for (const order of orders) {
            // Skip orders already in the target status
            if (order.orderStatus === status) {
                failed.push({ orderId: order.orderId, reason: 'already in that status' });
                continue;
            }
            // Cancelled orders cannot be moved to any other status
            if (order.orderStatus === 'cancelled' && status !== 'cancelled') {
                failed.push({ orderId: order.orderId, reason: 'cannot change status of a cancelled order' });
                continue;
            }
            toUpdate.push(order);
        }

        // IDs that were requested but not found in DB
        const foundIds = new Set(orders.map((o) => o.orderId));
        for (const id of orderIds) {
            if (!foundIds.has(id)) {
                failed.push({ orderId: id, reason: 'not found' });
            }
        }

        // Bulk update via updateMany for performance; also collect cancellation
        // restocks that must be applied individually.
        const successIds = toUpdate.map((o) => o.orderId);
        let updated = 0;

        if (successIds.length > 0) {
            const result = await OrderModel.updateMany(
                { orderId: { $in: successIds } },
                { $set: { orderStatus: status } }
            );
            updated = result.modifiedCount;

            // Restock for any orders being cancelled
            if (status === 'cancelled') {
                const cancellations = toUpdate.filter((o) => o.orderStatus !== 'cancelled');
                for (const order of cancellations) {
                    const deltas = order.items
                        .filter((i) => i.weightIndex !== undefined)
                        .map((i) => ({ productId: i.productId, weightIndex: i.weightIndex, delta: i.quantity }));
                    if (deltas.length > 0) {
                        await applyStockDeltas(deltas);
                        await recordStockMovements(
                            order.items.map((i) => ({
                                productId: i.productId,
                                productName: i.productName,
                                weightIndex: i.weightIndex,
                                weight: i.weight,
                                delta: i.quantity,
                            })),
                            { reason: 'cancel', channel: 'admin', orderId: order.orderId, actor: actorFromReq(request), note: 'Bulk cancel' }
                        );
                    }
                }
            }

            // Fire-and-forget status emails for all successfully updated orders
            const updatedOrders = await OrderModel.find({ orderId: { $in: successIds } }).lean();
            for (const order of updatedOrders) {
                sendOrderStatusEmail(order).catch((err) => logger.warn({ err, orderId: order.orderId }, 'Bulk status email failed'));
            }
        }

        return response.json({
            message: `Bulk update complete: ${updated} updated, ${failed.length} failed`,
            error: false,
            success: true,
            data: { updated, failed }
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const exportOrdersCsvController = async (request, response) => {
    try {
        const { status, source, startDate, endDate } = request.query;

        const match = {};
        if (status && status !== 'all') match.orderStatus = status;
        if (source && source !== 'all') match.source = source;
        if (startDate || endDate) {
            match.createdAt = {};
            if (startDate) match.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                match.createdAt.$lte = end;
            }
        }

        const today = new Date().toISOString().slice(0, 10);
        response.setHeader('Content-Type', 'text/csv; charset=utf-8');
        response.setHeader('Content-Disposition', `attachment; filename="orders-${today}.csv"`);

        const HEADERS = [
            'Order ID', 'Date', 'Customer Name', 'Phone', 'Email',
            'City', 'Address', 'Items', 'Subtotal', 'Delivery Charge',
            'Coupon Discount', 'Manual Discount', 'Total Amount',
            'Payment Method', 'Payment Status', 'Order Status', 'Source', 'Notes'
        ];

        const escapeCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

        response.write(HEADERS.map(escapeCell).join(',') + '\r\n');

        const cursor = OrderModel.find(match).sort({ createdAt: -1 }).lean().cursor();

        for await (const order of cursor) {
            const itemsSummary = (order.items || [])
                .map((i) => `${i.productName} x${i.quantity}${i.weight ? ` (${i.weight})` : ''}`)
                .join('; ');

            const couponDiscount = order.couponCode && order.discount
                ? order.discount - (order.manualDiscount?.amount || 0)
                : (order.couponCode ? order.discount : 0);
            const manualDiscount = order.manualDiscount?.amount || 0;

            const paymentMethodLabel = {
                cash_on_delivery: 'Cash on Delivery',
                online: 'Online (SSLCommerz)',
                cash: 'Cash',
                card: 'Card',
                bkash: 'bKash',
                nagad: 'Nagad',
                rocket: 'Rocket',
            }[order.paymentMethod] || order.paymentMethod || '';

            const row = [
                order.orderId,
                new Date(order.createdAt).toISOString().slice(0, 10),
                order.customerName,
                order.customerPhone,
                order.customerEmail || '',
                order.city || '',
                order.shippingAddress,
                itemsSummary,
                order.subtotal ?? 0,
                order.deliveryCharge ?? 0,
                couponDiscount,
                manualDiscount,
                order.totalAmount ?? 0,
                paymentMethodLabel,
                order.paymentStatus || '',
                order.orderStatus || '',
                order.source || 'ecommerce',
                order.notes || '',
            ];

            response.write(row.map(escapeCell).join(',') + '\r\n');
        }

        response.end();

    } catch (error) {
        // Headers may already be sent — just end the stream
        if (!response.headersSent) {
            return response.status(500).json({
                message: error.message || error,
                error: true,
                success: false
            });
        }
        response.end();
    }
};

export const getOrdersByPhoneController = async (request, response) => {
    try {
        const { phone } = request.body;

        if (!phone) {
            return response.status(400).json({
                message: "Phone number is required",
                error: true,
                success: false
            });
        }

        const orders = await OrderModel.find({ customerPhone: phone }).sort({ createdAt: -1 });

        return response.json({
            message: "Orders fetched successfully",
            data: orders,
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

// ── Client: submit a return request ──────────────────────────────────────────
//
// Requires a signed-in customer (requireCustomer middleware).
// Validates: order belongs to this customer, status === 'delivered',
// returnAvailableUntil is in the future (return window not expired).
// Stores reason + description, sets status to 'return_requested'.
export const clientReturnRequestController = async (request, response) => {
    try {
        const { orderId } = request.params;
        const { reason, description = '' } = request.body;

        if (!reason) {
            return response.status(400).json({
                message: "Return reason is required",
                error: true,
                success: false
            });
        }

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        // Ownership check: the order must belong to the signed-in customer.
        if (!order.customerId || String(order.customerId) !== String(request.customer._id)) {
            return response.status(403).json({
                message: "You do not have permission to request a return for this order",
                error: true,
                success: false
            });
        }

        if (order.orderStatus !== 'delivered') {
            return response.status(400).json({
                message: "Only delivered orders can be returned",
                error: true,
                success: false
            });
        }

        if (!order.returnAvailableUntil || order.returnAvailableUntil < new Date()) {
            return response.status(400).json({
                message: "The return window for this order has expired",
                error: true,
                success: false
            });
        }

        // Save reason as a prefixed note so it surfaces in the admin notes field
        // without requiring a schema migration.
        const returnNote = `[Return Request] Reason: ${reason}${description ? ` — ${description}` : ''}`;
        order.orderStatus = 'return_requested';
        order.adminNotes = order.adminNotes
            ? `${order.adminNotes}\n${returnNote}`
            : returnNote;

        await order.save();

        // Alert the admin via WhatsApp (best-effort, fire-and-forget).
        notifyAdminNewOrder(order).catch(() => {});

        return response.json({
            message: "Return request submitted successfully",
            data: order,
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

// ── Admin: approve a return request ──────────────────────────────────────────
//
// Sets status to 'returned', restocks items, and optionally issues a gateway
// refund for online-paid orders (SSLCommerz only for now).
export const adminReturnApproveController = async (request, response) => {
    try {
        const { orderId } = request.params;
        const { adminNote = '', restock = true } = request.body;

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        if (order.orderStatus !== 'return_requested') {
            return response.status(400).json({
                message: "Order is not in return_requested status",
                error: true,
                success: false
            });
        }

        order.orderStatus = 'returned';
        if (adminNote) {
            order.adminNotes = order.adminNotes
                ? `${order.adminNotes}\n[Return Approved] ${adminNote}`
                : `[Return Approved] ${adminNote}`;
        }

        await order.save();

        // Restock all items (positive delta — trusting admin action).
        if (restock !== false) {
            const stockableItems = order.items.filter((i) => i.weightIndex !== undefined);
            if (stockableItems.length > 0) {
                await applyStockDeltas(
                    stockableItems.map((i) => ({
                        productId: i.productId,
                        weightIndex: i.weightIndex,
                        delta: i.quantity
                    }))
                );
                await recordStockMovements(
                    order.items.map((i) => ({
                        productId: i.productId,
                        productName: i.productName,
                        weightIndex: i.weightIndex,
                        weight: i.weight,
                        delta: i.quantity,
                    })),
                    { reason: 'return', channel: 'ecommerce', orderId, actor: actorFromReq(request) }
                );
            }
        }

        // Attempt gateway refund for SSLCommerz online orders (best-effort).
        let refundResult = null;
        if (order.paymentMethod === 'online') {
            try {
                const payment = await PaymentModel.findOne({ orderId, status: 'paid' });
                if (payment?.bankTranId) {
                    const settings = await getSettings(request.tenantId);
                    const result = await sslRefund({
                        sandbox: settings?.payment?.sandbox ?? true,
                        storeId: settings?.payment?.storeId || '',
                        storePassword: settings?.payment?.storePassword || '',
                        bankTranId: payment.bankTranId,
                        amount: order.totalAmount,
                        remarks: adminNote || 'Return approved by admin',
                    });
                    refundResult = result;

                    await PaymentModel.updateOne(
                        { _id: payment._id },
                        {
                            $set: {
                                status: 'refunded',
                                'refund.refId': result?.refund_ref_id || '',
                                'refund.amount': order.totalAmount,
                                'refund.status': result?.status || '',
                                'refund.remarks': adminNote || 'Return approved',
                                'refund.at': new Date(),
                            }
                        }
                    );

                    order.paymentStatus = 'refunded';
                    await order.save();
                }
            } catch (refundErr) {
                logger.warn({ err: refundErr, orderId }, 'Gateway refund attempt failed during return approve');
            }
        }

        // Notify customer of status change (best-effort, fire-and-forget).
        notifyCustomerStatusChange(order).catch(() => {});
        sendOrderStatusEmail(order).catch((err) => logger.warn({ err }, 'Return status email failed'));

        return response.json({
            message: "Return approved successfully",
            data: { order, refundResult },
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

// ── Admin: verify a COD partial deposit ──────────────────────────────────────
//
// Marks depositVerified = true and stamps who verified it and when.
// Called from the order detail panel when an admin has manually confirmed
// the customer's bKash/Nagad/Rocket transaction ID in the merchant app.
export const adminVerifyDepositController = async (request, response) => {
    try {
        const { orderId } = request.params;

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        if (!order.depositTransactionId) {
            return response.status(400).json({
                message: "This order has no deposit transaction ID to verify",
                error: true,
                success: false
            });
        }

        if (order.depositVerified) {
            return response.status(400).json({
                message: "Deposit is already verified",
                error: true,
                success: false
            });
        }

        order.depositVerified = true;
        order.depositVerifiedAt = new Date();
        order.depositVerifiedBy = request.admin?.username || request.admin?.email || 'admin';
        await order.save();

        return response.json({
            message: "Deposit verified successfully",
            data: order,
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

// ── Admin: reject a return request ───────────────────────────────────────────
//
// Restores status to 'delivered' so the customer can't re-request immediately
// and sees the correct current state. Records the rejection reason in adminNotes.
export const adminReturnRejectController = async (request, response) => {
    try {
        const { orderId } = request.params;
        const { reason = '' } = request.body;

        const order = await OrderModel.findOne({ orderId });

        if (!order) {
            return response.status(404).json({
                message: "Order not found",
                error: true,
                success: false
            });
        }

        if (order.orderStatus !== 'return_requested') {
            return response.status(400).json({
                message: "Order is not in return_requested status",
                error: true,
                success: false
            });
        }

        const rejectionNote = `[Return Rejected]${reason ? ` ${reason}` : ''}`;
        order.orderStatus = 'delivered';
        order.adminNotes = order.adminNotes
            ? `${order.adminNotes}\n${rejectionNote}`
            : rejectionNote;

        await order.save();

        // Notify customer (best-effort, fire-and-forget).
        notifyCustomerStatusChange(order).catch(() => {});

        return response.json({
            message: "Return request rejected",
            data: order,
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