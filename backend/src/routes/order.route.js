import { Router } from 'express'
import { createOrderController, updateOrderStatusController, getAllOrdersController, getOrderDetailsController, getStockReportController, updateStockController, getOrderStatsController, confirmOrderController, getOrdersByPhoneController } from '../controllers/order.controller.js'
import { requirePermission, requireAnyPermission } from '../middlewares/auth.middleware.js'

const orderRouter = Router()

orderRouter.post('/create', requirePermission('order:write'), createOrderController)
orderRouter.post('/get-all', requirePermission('order:read'), getAllOrdersController)
orderRouter.post('/get-details', requirePermission('order:read'), getOrderDetailsController)
// Status change: granted by full order write OR the narrower order:status
// (salesman can advance an order's status but not edit/create/delete).
orderRouter.put('/update-status', requireAnyPermission('order:write', 'order:status'), updateOrderStatusController)
orderRouter.post('/stock-report', requirePermission('inventory:read'), getStockReportController)
orderRouter.put('/update-stock', requirePermission('inventory:write'), updateStockController)
orderRouter.post('/stats', requireAnyPermission('order:read', 'analytics:read'), getOrderStatsController)

// Admin order management
orderRouter.put('/confirm-order', requirePermission('order:write'), confirmOrderController)

// Client track order by phone
orderRouter.post('/track-by-phone', requirePermission('order:read'), getOrdersByPhoneController)

export default orderRouter