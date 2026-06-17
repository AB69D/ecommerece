import { Router } from 'express';
import { requirePermission, requireAnyPermission } from '../middlewares/auth.middleware.js';
import {
    dispatchOrderController,
    trackOrderController,
    steadfastBalanceController,
    codSummaryController,
    remittanceOrdersController,
    markRemittedController,
} from '../controllers/courier.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const courierRouter = Router();

// Dispatch an order via a courier (creates consignment at Pathao / Steadfast)
courierRouter.post(
    '/dispatch/:orderId',
    requirePermission('order:write'),
    asyncHandler(dispatchOrderController),
);

// Get live tracking status for an already-dispatched order
courierRouter.get(
    '/track/:orderId',
    requirePermission('order:read'),
    asyncHandler(trackOrderController),
);

// Steadfast live COD balance (hits Steadfast API)
courierRouter.get(
    '/steadfast-balance',
    requireAnyPermission('analytics:read', 'order:read'),
    asyncHandler(steadfastBalanceController),
);

// Estimated pending COD from own order records (both couriers)
courierRouter.get(
    '/cod-summary',
    requireAnyPermission('analytics:read', 'order:read'),
    asyncHandler(codSummaryController),
);

// Per-order detail for unremitted COD orders (used by the Remittance detail page)
courierRouter.get(
    '/remittance-orders',
    requirePermission('order:read'),
    asyncHandler(remittanceOrdersController),
);

// Mark delivered COD orders as remitted (after receiving bank transfer)
courierRouter.post(
    '/mark-remitted',
    requirePermission('order:write'),
    asyncHandler(markRemittedController),
);

export default courierRouter;
