import { Router } from 'express'
import { requirePermission } from '../middlewares/auth.middleware.js'
import {
    listLocationsController,
    createLocationController,
    updateLocationController,
    deactivateLocationController,
    getLocationStockController,
    adjustLocationStockController,
} from '../controllers/location.controller.js'

const locationRouter = Router()

locationRouter.get('/', requirePermission('inventory:read'), listLocationsController)
locationRouter.post('/', requirePermission('inventory:write'), createLocationController)
locationRouter.put('/:id', requirePermission('inventory:write'), updateLocationController)
locationRouter.delete('/:id', requirePermission('inventory:write'), deactivateLocationController)
locationRouter.get('/:id/stock', requirePermission('inventory:read'), getLocationStockController)
locationRouter.patch('/:id/stock', requirePermission('inventory:write'), adjustLocationStockController)

export default locationRouter
