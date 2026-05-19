import OrderModel from "../models/order.model.js";
import ProductModel from "../models/product.model.js";

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

        await order.save();

        for (const item of items) {
            if (item.weightIndex !== undefined) {
                await ProductModel.updateOne(
                    { _id: item.productId },
                    { $inc: { [`weights.${item.weightIndex}.stock`]: -item.quantity } }
                );
            }
        }

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

        if ((orderStatus === 'cancelled' || orderStatus === 'failed') && (previousStatus !== 'cancelled' && previousStatus !== 'failed')) {
            for (const item of order.items) {
                if (item.weightIndex !== undefined) {
                    await ProductModel.updateOne(
                        { _id: item.productId },
                        { $inc: { [`weights.${item.weightIndex}.stock`]: item.quantity } }
                    );
                }
            }
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
        let { page, limit, search, status } = request.body;

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
        const { productId, weightIndex, quantity, action } = request.body;

        if (!productId || weightIndex === undefined || !quantity || !action) {
            return response.status(400).json({
                message: "productId, weightIndex, quantity, and action are required",
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

        const stockChange = action === 'add' ? parseInt(quantity) : -parseInt(quantity);

        const product = await ProductModel.findOne({ _id: productId });

        if (!product) {
            return response.status(404).json({
                message: "Product not found",
                error: true,
                success: false
            });
        }

        const currentStock = product.weights[weightIndex]?.stock || 0;

        if (action === 'subtract' && currentStock < quantity) {
            return response.status(400).json({
                message: "Cannot subtract more than available stock",
                error: true,
                success: false
            });
        }

        await ProductModel.updateOne(
            { _id: productId },
            { $inc: { [`weights.${weightIndex}.stock`]: stockChange } }
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
        const totalOrders = await OrderModel.countDocuments();
        const pendingOrders = await OrderModel.countDocuments({ orderStatus: 'pending' });
        const confirmedOrders = await OrderModel.countDocuments({ orderStatus: 'confirmed' });
        const processingOrders = await OrderModel.countDocuments({ orderStatus: 'processing' });
        const shippedOrders = await OrderModel.countDocuments({ orderStatus: 'shipped' });
        const deliveredOrders = await OrderModel.countDocuments({ orderStatus: 'delivered' });
        const cancelledOrders = await OrderModel.countDocuments({ orderStatus: 'cancelled' });

        const totalRevenue = await OrderModel.aggregate([
            { $match: { orderStatus: { $nin: ['cancelled', 'failed'] } } },
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