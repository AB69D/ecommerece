import { Router } from 'express'
import { requirePermission } from '../middlewares/auth.middleware.js'
import {
    getVatConfigController,
    updateVatConfigController,
    listVatInvoicesController,
    getVatInvoiceController,
    generateInvoiceForOrderController,
    getMushak91ReportController,
} from '../controllers/vatConfig.controller.js'

const vatRouter = Router()

// Admin VAT config
vatRouter.get('/config', requirePermission('settings:read'), getVatConfigController)
vatRouter.put('/config', requirePermission('settings:write'), updateVatConfigController)

// Admin invoice management
vatRouter.get('/invoices', requirePermission('order:read'), listVatInvoicesController)
vatRouter.get('/invoices/:id', requirePermission('order:read'), getVatInvoiceController)
vatRouter.post('/invoice/:orderId', requirePermission('order:write'), generateInvoiceForOrderController)

// Mushak 9.1 export report
vatRouter.get('/report/mushak91', requirePermission('analytics:read'), getMushak91ReportController)

export default vatRouter
