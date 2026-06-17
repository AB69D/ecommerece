/**
 * Stock Transfer Controller
 *
 * Handles inter-location stock transfers:
 *   - List and create draft transfers
 *   - Ship (draft → in_transit): deducts from source
 *   - Receive (in_transit → received): credits to destination
 *   - Cancel (draft only)
 *
 * Ship and receive use MongoDB sessions/transactions for atomicity.
 */
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../lib/ApiError.js'
import * as ApiResponse from '../lib/ApiResponse.js'
import { StockTransferModel } from '../models/StockTransfer.model.js'
import { LocationModel } from '../models/Location.model.js'
import { LocationStockModel } from '../models/LocationStock.model.js'
import { recordStockMovements, actorFromReq } from '../lib/stockLedger.js'

// ── GET /admin/stock-transfer ─────────────────────────────────────────────────
export const listTransfersController = asyncHandler(async (req, res) => {
    const { status, fromLocationId, toLocationId, page = 1, limit = 20 } = req.query

    const filter = {}
    if (status) filter.status = status
    if (fromLocationId && mongoose.Types.ObjectId.isValid(fromLocationId)) {
        filter.fromLocationId = new mongoose.Types.ObjectId(fromLocationId)
    }
    if (toLocationId && mongoose.Types.ObjectId.isValid(toLocationId)) {
        filter.toLocationId = new mongoose.Types.ObjectId(toLocationId)
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    const [transfers, total] = await Promise.all([
        StockTransferModel.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('fromLocationId toLocationId', 'name code type')
            .lean(),
        StockTransferModel.countDocuments(filter),
    ])

    return ApiResponse.ok(res, {
        transfers,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        },
    }, 'Stock transfers retrieved')
})

// ── POST /admin/stock-transfer ────────────────────────────────────────────────
// Creates a draft transfer. Does NOT yet deduct stock from source.
export const createTransferController = asyncHandler(async (req, res) => {
    const { fromLocationId, toLocationId, items, notes } = req.body

    // Basic validation
    if (!fromLocationId || !mongoose.Types.ObjectId.isValid(fromLocationId)) {
        throw ApiError.badRequest('Valid fromLocationId is required')
    }
    if (!toLocationId || !mongoose.Types.ObjectId.isValid(toLocationId)) {
        throw ApiError.badRequest('Valid toLocationId is required')
    }
    if (String(fromLocationId) === String(toLocationId)) {
        throw ApiError.badRequest('Source and destination locations must be different')
    }
    if (!Array.isArray(items) || items.length === 0) {
        throw ApiError.badRequest('At least one item is required')
    }

    // Validate all items have required fields
    for (const item of items) {
        if (!item.productId || !mongoose.Types.ObjectId.isValid(item.productId)) {
            throw ApiError.badRequest('Each item must have a valid productId')
        }
        if (item.weightIndex === undefined || item.weightIndex === null || isNaN(Number(item.weightIndex))) {
            throw ApiError.badRequest('Each item must have a valid weightIndex')
        }
        const qty = Number(item.requestedQty)
        if (!qty || qty < 1 || !Number.isInteger(qty)) {
            throw ApiError.badRequest(`requestedQty must be a positive integer (got ${item.requestedQty} for ${item.productName || item.productId})`)
        }
    }

    // Verify both locations exist and are active
    const [fromLocation, toLocation] = await Promise.all([
        LocationModel.findById(fromLocationId).lean(),
        LocationModel.findById(toLocationId).lean(),
    ])
    if (!fromLocation) throw ApiError.notFound('Source location not found')
    if (!toLocation) throw ApiError.notFound('Destination location not found')
    if (!fromLocation.active) throw ApiError.badRequest('Source location is inactive')
    if (!toLocation.active) throw ApiError.badRequest('Destination location is inactive')

    // Check available stock at source for each item
    const stockShortfalls = []
    for (const item of items) {
        const srcStock = await LocationStockModel.findOne({
            productId: new mongoose.Types.ObjectId(item.productId),
            weightIndex: Number(item.weightIndex),
            locationId: new mongoose.Types.ObjectId(fromLocationId),
        }).lean()

        const available = srcStock ? Math.max(0, (srcStock.stock || 0) - (srcStock.reservedQty || 0)) : 0
        if (available < Number(item.requestedQty)) {
            stockShortfalls.push(
                `"${item.productName || item.productId}" (need ${item.requestedQty}, available ${available} at ${fromLocation.name})`,
            )
        }
    }
    if (stockShortfalls.length > 0) {
        throw ApiError.badRequest(`Insufficient stock at source location: ${stockShortfalls.join('; ')}`)
    }

    const transferNo = `TRF-${Date.now()}`
    const actor = actorFromReq(req)

    const transfer = await StockTransferModel.create({
        transferNo,
        fromLocationId: new mongoose.Types.ObjectId(fromLocationId),
        toLocationId: new mongoose.Types.ObjectId(toLocationId),
        status: 'draft',
        items: items.map((item) => ({
            productId: new mongoose.Types.ObjectId(item.productId),
            weightIndex: Number(item.weightIndex),
            productName: item.productName || '',
            weightLabel: item.weightLabel || '',
            requestedQty: Number(item.requestedQty),
            shippedQty: 0,
            receivedQty: 0,
        })),
        notes: notes || '',
        createdBy: actor.username || actor.id || '',
    })

    return ApiResponse.created(res, transfer.toObject(), 'Stock transfer created')
})

// ── PATCH /admin/stock-transfer/:id/ship ─────────────────────────────────────
// Transitions draft → in_transit. Atomically deducts stock from source.
export const shipTransferController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid transfer id')

    // Load transfer (tenantPlugin auto-scopes)
    const transfer = await StockTransferModel.findById(id)
        .populate('fromLocationId toLocationId', 'name code')
    if (!transfer) throw ApiError.notFound('Stock transfer not found')
    if (transfer.status !== 'draft') {
        throw ApiError.badRequest(`Transfer is "${transfer.status}" — only draft transfers can be shipped`)
    }

    const fromLocation = transfer.fromLocationId
    const toLocation = transfer.toLocationId

    // Use a MongoDB session for atomic multi-doc deductions
    const session = await mongoose.startSession()
    try {
        await session.withTransaction(async () => {
            for (const item of transfer.items) {
                const qty = item.requestedQty

                // Deduct stock from source — fail if result goes negative
                const updated = await LocationStockModel.findOneAndUpdate(
                    {
                        productId: item.productId,
                        weightIndex: item.weightIndex,
                        locationId: transfer.fromLocationId._id || transfer.fromLocationId,
                        stock: { $gte: qty }, // guard: reject if insufficient
                    },
                    { $inc: { stock: -qty } },
                    { new: true, session },
                )

                if (!updated) {
                    // Either doc doesn't exist or stock < qty — find out which
                    const current = await LocationStockModel.findOne({
                        productId: item.productId,
                        weightIndex: item.weightIndex,
                        locationId: transfer.fromLocationId._id || transfer.fromLocationId,
                    }, null, { session }).lean()

                    const available = current ? current.stock : 0
                    throw ApiError.badRequest(
                        `Insufficient stock for "${item.productName}" at ${fromLocation.name} (available: ${available}, needed: ${qty})`,
                    )
                }

                item.shippedQty = qty
            }

            const actor = actorFromReq(req)
            transfer.status = 'in_transit'
            transfer.shippedAt = new Date()
            transfer.shippedBy = actor.username || actor.id || ''
            await transfer.save({ session })
        })
    } finally {
        await session.endSession()
    }

    // Record ledger entries (best-effort, outside transaction so a ledger failure
    // does NOT roll back the ship operation)
    try {
        const movementEntries = transfer.items.map((item) => ({
            productId: String(item.productId),
            productName: item.productName,
            weightIndex: item.weightIndex,
            weight: item.weightLabel,
            delta: -item.shippedQty,
        }))

        await recordStockMovements(movementEntries, {
            reason: 'adjustment',
            channel: 'admin',
            actor: actorFromReq(req),
            note: `Transfer out to ${toLocation.name} (${toLocation.code}) — ref ${transfer.transferNo}`,
        })
    } catch (_) { /* best-effort */ }

    const result = await StockTransferModel.findById(id)
        .populate('fromLocationId toLocationId', 'name code')
        .lean()

    return ApiResponse.ok(res, result, 'Transfer shipped — stock deducted from source')
})

// ── PATCH /admin/stock-transfer/:id/receive ───────────────────────────────────
// Transitions in_transit → received. Credits received qty to destination.
// Body: { items: [{ productId, weightIndex, receivedQty }] } (can differ from requested)
export const receiveTransferController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid transfer id')

    const transfer = await StockTransferModel.findById(id)
        .populate('fromLocationId toLocationId', 'name code')
    if (!transfer) throw ApiError.notFound('Stock transfer not found')
    if (transfer.status !== 'in_transit') {
        throw ApiError.badRequest(`Transfer is "${transfer.status}" — only in-transit transfers can be received`)
    }

    const { items: receivedItems } = req.body

    // Build a lookup map of received quantities by productId+weightIndex
    // If body omits items, default to shippedQty for each line
    const receivedMap = new Map()
    if (Array.isArray(receivedItems)) {
        for (const ri of receivedItems) {
            const key = `${ri.productId}:${ri.weightIndex}`
            const qty = Number(ri.receivedQty)
            if (isNaN(qty) || qty < 0) {
                throw ApiError.badRequest(`receivedQty must be >= 0 for product ${ri.productId}`)
            }
            receivedMap.set(key, qty)
        }
    }

    const fromLocation = transfer.fromLocationId
    const toLocation = transfer.toLocationId

    const session = await mongoose.startSession()
    try {
        await session.withTransaction(async () => {
            for (const item of transfer.items) {
                const key = `${item.productId}:${item.weightIndex}`
                const receivedQty = receivedMap.has(key) ? receivedMap.get(key) : item.shippedQty

                if (receivedQty > 0) {
                    // Credit stock to destination (upsert — destination may not have a record yet)
                    await LocationStockModel.findOneAndUpdate(
                        {
                            productId: item.productId,
                            weightIndex: item.weightIndex,
                            locationId: transfer.toLocationId._id || transfer.toLocationId,
                        },
                        { $inc: { stock: receivedQty } },
                        { new: true, upsert: true, session },
                    )
                }

                item.receivedQty = receivedQty
            }

            const actor = actorFromReq(req)
            transfer.status = 'received'
            transfer.receivedAt = new Date()
            transfer.receivedBy = actor.username || actor.id || ''
            await transfer.save({ session })
        })
    } finally {
        await session.endSession()
    }

    // Record ledger entries (best-effort)
    try {
        const movementEntries = transfer.items
            .filter((item) => item.receivedQty > 0)
            .map((item) => ({
                productId: String(item.productId),
                productName: item.productName,
                weightIndex: item.weightIndex,
                weight: item.weightLabel,
                delta: item.receivedQty,
            }))

        if (movementEntries.length > 0) {
            await recordStockMovements(movementEntries, {
                reason: 'adjustment',
                channel: 'admin',
                actor: actorFromReq(req),
                note: `Transfer in from ${fromLocation.name} (${fromLocation.code}) — ref ${transfer.transferNo}`,
            })
        }
    } catch (_) { /* best-effort */ }

    const result = await StockTransferModel.findById(id)
        .populate('fromLocationId toLocationId', 'name code')
        .lean()

    return ApiResponse.ok(res, result, 'Transfer received — stock credited to destination')
})

// ── PATCH /admin/stock-transfer/:id/cancel ────────────────────────────────────
// Only draft transfers can be cancelled.
export const cancelTransferController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid transfer id')

    const transfer = await StockTransferModel.findById(id)
    if (!transfer) throw ApiError.notFound('Stock transfer not found')

    if (transfer.status === 'in_transit') {
        throw ApiError.badRequest(
            'Cannot cancel an in-transit transfer. Receive it first to restore stock accuracy.',
        )
    }
    if (transfer.status === 'received') {
        throw ApiError.badRequest('Cannot cancel a completed (received) transfer.')
    }
    if (transfer.status === 'cancelled') {
        throw ApiError.badRequest('Transfer is already cancelled.')
    }

    transfer.status = 'cancelled'
    await transfer.save()

    return ApiResponse.ok(res, transfer.toObject(), 'Transfer cancelled')
})
