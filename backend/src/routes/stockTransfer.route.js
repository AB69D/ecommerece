import { Router } from 'express'
import { requirePermission } from '../middlewares/auth.middleware.js'
import {
    listTransfersController,
    createTransferController,
    shipTransferController,
    receiveTransferController,
    cancelTransferController,
} from '../controllers/stockTransfer.controller.js'

const stockTransferRouter = Router()

stockTransferRouter.get('/', requirePermission('inventory:read'), listTransfersController)
stockTransferRouter.post('/', requirePermission('inventory:write'), createTransferController)
stockTransferRouter.patch('/:id/ship', requirePermission('inventory:write'), shipTransferController)
stockTransferRouter.patch('/:id/receive', requirePermission('inventory:write'), receiveTransferController)
stockTransferRouter.patch('/:id/cancel', requirePermission('inventory:write'), cancelTransferController)

export default stockTransferRouter
