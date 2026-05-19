import { Router } from 'express'
import { createOrderController, updateOrderStatusController, getAllOrdersController, getOrderDetailsController, getStockReportController, updateStockController, getOrderStatsController, confirmOrderController, getOrdersByPhoneController } from '../controllers/order.controller.js'

const orderRouter = Router()

orderRouter.post('/create', createOrderController)
orderRouter.post('/get-all', getAllOrdersController)
orderRouter.post('/get-details', getOrderDetailsController)
orderRouter.put('/update-status', updateOrderStatusController)
orderRouter.post('/stock-report', getStockReportController)
orderRouter.put('/update-stock', updateStockController)
orderRouter.post('/stats', getOrderStatsController)

// Admin order management
orderRouter.put('/confirm-order', confirmOrderController)

// Client track order by phone
orderRouter.post('/track-by-phone', getOrdersByPhoneController)

export default orderRouter