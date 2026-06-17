/**
 * Location Controller
 *
 * Handles multi-warehouse location management:
 *   - List, create, update, deactivate locations
 *   - View stock levels per location (paginated, with product info)
 *   - Adjust stock at a specific location (admin-triggered, best-effort)
 */
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../lib/ApiError.js'
import * as ApiResponse from '../lib/ApiResponse.js'
import { LocationModel } from '../models/Location.model.js'
import { LocationStockModel } from '../models/LocationStock.model.js'
import ProductModel from '../models/product.model.js'
import { recordStockMovements, actorFromReq } from '../lib/stockLedger.js'
import OrderModel from '../models/order.model.js'

// ── GET /admin/location ───────────────────────────────────────────────────────
export const listLocationsController = asyncHandler(async (req, res) => {
    const { includeInactive } = req.query
    const filter = {}
    if (!includeInactive || includeInactive === 'false') {
        filter.active = true
    }

    const locations = await LocationModel.find(filter)
        .sort({ isDefault: -1, name: 1 })
        .lean()

    return ApiResponse.ok(res, locations, 'Locations retrieved')
})

// ── POST /admin/location ──────────────────────────────────────────────────────
export const createLocationController = asyncHandler(async (req, res) => {
    const { name, code, type, address, city, phone, managerName, isDefault, active } = req.body

    if (!name || !name.trim()) throw ApiError.badRequest('Location name is required')
    if (!code || !code.trim()) throw ApiError.badRequest('Location code is required')

    // Code: uppercase, alphanumeric + underscore/hyphen only
    const upperCode = String(code).trim().toUpperCase()
    if (!/^[A-Z0-9_-]+$/.test(upperCode)) {
        throw ApiError.badRequest('Location code must be alphanumeric (A-Z, 0-9, - or _ allowed)')
    }

    // Check code uniqueness per tenant (tenantPlugin scopes the query)
    const existing = await LocationModel.findOne({ code: upperCode })
    if (existing) {
        throw ApiError.conflict(`A location with code "${upperCode}" already exists`)
    }

    // If new location is default, unset any existing default
    if (isDefault) {
        await LocationModel.updateMany({ isDefault: true }, { $set: { isDefault: false } })
    }

    const location = await LocationModel.create({
        name: String(name).trim(),
        code: upperCode,
        type: type || 'warehouse',
        address: address || '',
        city: city || '',
        phone: phone || '',
        managerName: managerName || '',
        isDefault: !!isDefault,
        active: active !== undefined ? !!active : true,
    })

    return ApiResponse.created(res, location.toObject(), 'Location created')
})

// ── PUT /admin/location/:id ───────────────────────────────────────────────────
export const updateLocationController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid location id')

    const { name, code, type, address, city, phone, managerName, isDefault } = req.body

    // tenantPlugin auto-scopes findById (uses findOne internally)
    const location = await LocationModel.findById(id)
    if (!location) throw ApiError.notFound('Location not found')

    if (name !== undefined) location.name = String(name).trim()
    if (type !== undefined) location.type = type
    if (address !== undefined) location.address = address
    if (city !== undefined) location.city = city
    if (phone !== undefined) location.phone = phone
    if (managerName !== undefined) location.managerName = managerName

    if (code !== undefined) {
        const upperCode = String(code).trim().toUpperCase()
        if (!/^[A-Z0-9_-]+$/.test(upperCode)) {
            throw ApiError.badRequest('Location code must be alphanumeric (A-Z, 0-9, - or _ allowed)')
        }
        // Check uniqueness, excluding the current doc
        const codeConflict = await LocationModel.findOne({
            code: upperCode,
            _id: { $ne: location._id },
        })
        if (codeConflict) throw ApiError.conflict(`A location with code "${upperCode}" already exists`)
        location.code = upperCode
    }

    if (isDefault !== undefined && isDefault) {
        await LocationModel.updateMany(
            { isDefault: true, _id: { $ne: location._id } },
            { $set: { isDefault: false } },
        )
        location.isDefault = true
    }

    await location.save()
    return ApiResponse.ok(res, location.toObject(), 'Location updated')
})

// ── DELETE /admin/location/:id ────────────────────────────────────────────────
// Soft-delete: sets active=false. Never removes the document.
export const deactivateLocationController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid location id')

    const location = await LocationModel.findById(id)
    if (!location) throw ApiError.notFound('Location not found')

    if (location.isDefault) {
        throw ApiError.badRequest('Cannot deactivate the default location. Set another location as default first.')
    }

    // Block if this location still has stock
    const stockCount = await LocationStockModel.countDocuments({
        locationId: location._id,
        stock: { $gt: 0 },
    })
    if (stockCount > 0) {
        throw ApiError.badRequest(
            `Cannot deactivate location with remaining stock (${stockCount} variant(s) still have stock). Transfer or clear stock first.`,
        )
    }

    // Block if active orders are still assigned to this location
    const activeStatuses = ['pending', 'confirmed', 'processing']
    const activeOrderCount = await OrderModel.countDocuments({
        fulfillLocationId: location._id,
        orderStatus: { $in: activeStatuses },
    })
    if (activeOrderCount > 0) {
        throw ApiError.badRequest(
            `Cannot deactivate location assigned to ${activeOrderCount} active order(s). Reassign those orders first.`,
        )
    }

    location.active = false
    await location.save()
    return ApiResponse.ok(res, { id: location._id, active: false }, 'Location deactivated')
})

// ── GET /admin/location/:id/stock ─────────────────────────────────────────────
// Paginated list of stock entries for this location, with product info joined.
export const getLocationStockController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid location id')

    const location = await LocationModel.findById(id).lean()
    if (!location) throw ApiError.notFound('Location not found')

    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit
    const { search } = req.query

    // tenantPlugin scopes the $match automatically via find(), so we use aggregate
    // with an explicit tenantId match (per tenant isolation requirements for aggregates)
    const matchBase = {
        locationId: new mongoose.Types.ObjectId(id),
    }

    const [entries, total] = await Promise.all([
        LocationStockModel.find(matchBase)
            .sort({ stock: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: 'productId',
                select: 'name weights images',
                model: ProductModel,
            })
            .lean(),
        LocationStockModel.countDocuments(matchBase),
    ])

    // Build response rows, enriching with per-variant data
    const rows = entries
        .filter((e) => {
            if (!e.productId) return true // keep even if product deleted
            if (!search) return true
            const productName = e.productId?.name || ''
            return productName.toLowerCase().includes(search.toLowerCase())
        })
        .map((e) => {
            const product = e.productId || {}
            const variant = Array.isArray(product.weights)
                ? product.weights[e.weightIndex]
                : null

            return {
                _id: e._id,
                locationId: location._id,
                locationName: location.name,
                locationCode: location.code,
                productId: product._id || e.productId,
                productName: product.name || '(Deleted Product)',
                sku: variant?.sku || '',
                barcode: variant?.barcode || '',
                weightLabel: variant?.weight || `Variant ${e.weightIndex}`,
                price: variant?.price || 0,
                weightIndex: e.weightIndex,
                stock: e.stock,
                reservedQty: e.reservedQty,
                available: Math.max(0, e.stock - e.reservedQty),
            }
        })

    return ApiResponse.ok(res, {
        location: { _id: location._id, name: location.name, code: location.code },
        stock: rows,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    }, 'Location stock retrieved')
})

// ── PATCH /admin/location/:id/stock ──────────────────────────────────────────
// Admin-driven stock adjustment for a specific product variant at this location.
// Body: { productId, weightIndex, delta, reason, notes }
export const adjustLocationStockController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid location id')

    const { productId, weightIndex, delta, reason, notes } = req.body

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        throw ApiError.badRequest('Valid productId is required')
    }
    if (weightIndex === undefined || weightIndex === null || isNaN(Number(weightIndex))) {
        throw ApiError.badRequest('weightIndex is required')
    }
    const parsedDelta = Number(delta)
    if (!parsedDelta || isNaN(parsedDelta)) {
        throw ApiError.badRequest('delta must be a non-zero number')
    }
    const wIdx = Number(weightIndex)

    const location = await LocationModel.findById(id).lean()
    if (!location) throw ApiError.notFound('Location not found')

    // For negative adjustments, validate sufficient stock
    if (parsedDelta < 0) {
        const current = await LocationStockModel.findOne({
            productId: new mongoose.Types.ObjectId(productId),
            weightIndex: wIdx,
            locationId: new mongoose.Types.ObjectId(id),
        }).lean()

        const currentStock = current?.stock || 0
        if (currentStock + parsedDelta < 0) {
            throw ApiError.badRequest(
                `Insufficient stock. Current stock: ${currentStock}, requested reduction: ${Math.abs(parsedDelta)}`,
            )
        }
    }

    // Upsert: increment stock atomically
    const updated = await LocationStockModel.findOneAndUpdate(
        {
            productId: new mongoose.Types.ObjectId(productId),
            weightIndex: wIdx,
            locationId: new mongoose.Types.ObjectId(id),
        },
        { $inc: { stock: parsedDelta } },
        { new: true, upsert: true },
    )

    // Fetch product name for ledger record (best-effort)
    let productName = ''
    let weightLabel = ''
    try {
        const product = await ProductModel.findById(productId).select('name weights').lean()
        productName = product?.name || ''
        weightLabel = product?.weights?.[wIdx]?.weight || `Variant ${wIdx}`
    } catch (_) { /* best-effort */ }

    // Record stock movement in ledger (best-effort, never throws)
    await recordStockMovements(
        [{
            productId: String(productId),
            productName,
            weightIndex: wIdx,
            weight: weightLabel,
            delta: parsedDelta,
            balanceAfter: updated.stock,
        }],
        {
            reason: reason || 'adjustment',
            channel: 'admin',
            actor: actorFromReq(req),
            note: notes || `Manual adjustment at location ${location.name}`,
        },
    )

    return ApiResponse.ok(res, {
        productId,
        weightIndex: wIdx,
        locationId: id,
        locationName: location.name,
        stock: updated.stock,
        reservedQty: updated.reservedQty,
        available: Math.max(0, updated.stock - updated.reservedQty),
        delta: parsedDelta,
    }, 'Stock adjusted')
})
