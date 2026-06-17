/**
 * VAT Configuration & Invoice Controller
 *
 * Handles:
 *   - Admin VAT config read/update (linked to SiteSettings.vat)
 *   - Mushak 6.3 invoice listing, detail, and on-demand generation
 *   - Mushak 9.1 monthly sales report (CSV + JSON)
 *   - Customer-facing invoice view (via clientOrder.route.js)
 */
import mongoose from 'mongoose'
import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from '../lib/ApiError.js'
import * as ApiResponse from '../lib/ApiResponse.js'
import { getSettings, invalidateSettingsCache } from '../lib/siteSettings.js'
import { calculateVat, generateMushakInvoiceNo, generateMushak63Html } from '../lib/vat.js'
import VatInvoiceModel from '../models/VatInvoice.model.js'
import { SiteSettings } from '../models/siteSettings.model.js'
import OrderModel from '../models/order.model.js'
import { logger } from '../lib/logger.js'

// ── GET /admin/vat/config ─────────────────────────────────────────────────────
export const getVatConfigController = asyncHandler(async (req, res) => {
    const settings = await getSettings()
    return ApiResponse.ok(res, settings?.vat || {}, 'VAT configuration')
})

// ── PUT /admin/vat/config ─────────────────────────────────────────────────────
export const updateVatConfigController = asyncHandler(async (req, res) => {
    const {
        registrationNumber,
        businessName,
        businessAddress,
        sectorType,
        rate,
        mushakPrefix,
        registrationDate,
    } = req.body

    // Validate rate
    if (rate !== undefined) {
        const r = Number(rate)
        if (isNaN(r) || r < 0 || r > 100) {
            throw ApiError.badRequest('VAT rate must be between 0 and 100')
        }
    }

    // Validate registrationNumber format (NBR e-BIN: exactly 13 digits)
    if (registrationNumber !== undefined && registrationNumber !== '') {
        const bin = String(registrationNumber).trim()
        if (!/^\d{9}-\d{4}$/.test(bin) && !/^\d{13}$/.test(bin)) {
            throw ApiError.badRequest('e-BIN must be 13 digits or in format XXXXXXXXX-XXXX')
        }
    }

    const validSectors = ['retail', 'restaurant', 'pharmacy', 'digital', 'export', 'other']
    if (sectorType !== undefined && !validSectors.includes(sectorType)) {
        throw ApiError.badRequest(`sectorType must be one of: ${validSectors.join(', ')}`)
    }

    // Build the $set payload — only update fields that were explicitly supplied
    const $set = {}
    if (registrationNumber !== undefined) $set['vat.registrationNumber'] = String(registrationNumber).trim()
    if (businessName !== undefined) $set['vat.businessName'] = String(businessName).trim()
    if (businessAddress !== undefined) $set['vat.businessAddress'] = String(businessAddress).trim()
    if (sectorType !== undefined) $set['vat.sectorType'] = sectorType
    if (rate !== undefined) $set['vat.rate'] = Number(rate)
    if (mushakPrefix !== undefined) $set['vat.mushakPrefix'] = String(mushakPrefix).trim() || 'MSHK'
    if (registrationDate !== undefined) $set['vat.registrationDate'] = registrationDate ? new Date(registrationDate) : null

    // Auto-enable vatEnabled feature flag if the tenant supplies a BIN + rate
    const effectiveRate = rate !== undefined ? Number(rate) : null
    const effectiveBin = registrationNumber !== undefined ? String(registrationNumber).trim() : null
    if (effectiveRate && effectiveBin) {
        $set['features.vatEnabled'] = true
    }

    const updated = await SiteSettings.findOneAndUpdate(
        { tenantId: req.tenantId },
        { $set },
        { new: true, upsert: false },
    )

    if (!updated) throw ApiError.notFound('Site settings not found for this tenant')

    await invalidateSettingsCache()

    return ApiResponse.ok(res, updated.vat, 'VAT configuration updated')
})

// ── GET /admin/vat/invoices ───────────────────────────────────────────────────
export const listVatInvoicesController = asyncHandler(async (req, res) => {
    const {
        dateFrom,
        dateTo,
        orderId,
        page = 1,
        limit = 20,
    } = req.query

    const match = {}

    if (dateFrom || dateTo) {
        match.invoiceDate = {}
        if (dateFrom) match.invoiceDate.$gte = new Date(dateFrom)
        if (dateTo) {
            const end = new Date(dateTo)
            end.setHours(23, 59, 59, 999)
            match.invoiceDate.$lte = end
        }
    }

    if (orderId) {
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            throw ApiError.badRequest('Invalid orderId')
        }
        match.orderId = new mongoose.Types.ObjectId(orderId)
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
    const skip = (pageNum - 1) * limitNum

    // tenantPlugin auto-scopes the find() to req.tenantId
    const [invoices, total] = await Promise.all([
        VatInvoiceModel.find(match)
            .sort({ invoiceDate: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean(),
        VatInvoiceModel.countDocuments(match),
    ])

    return ApiResponse.ok(res, {
        invoices,
        pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        },
    }, 'VAT invoices')
})

// ── GET /admin/vat/invoices/:id ───────────────────────────────────────────────
export const getVatInvoiceController = asyncHandler(async (req, res) => {
    const { id } = req.params
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid invoice id')

    // tenantPlugin scopes findById via findOne under the hood
    const invoice = await VatInvoiceModel.findById(id).lean()
    if (!invoice) throw ApiError.notFound('VAT invoice not found')

    const { format } = req.query
    if (format === 'html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        return res.send(generateMushak63Html(invoice))
    }

    // JSON response: include pre-generated HTML for convenience
    return ApiResponse.ok(res, {
        invoice,
        html: generateMushak63Html(invoice),
    }, 'VAT invoice')
})

// ── POST /admin/vat/invoice/:orderId ─────────────────────────────────────────
// Create (or regenerate) a Mushak 6.3 invoice for any order.
export const generateInvoiceForOrderController = asyncHandler(async (req, res) => {
    const { orderId: orderParam } = req.params

    // Accept both _id (ObjectId) and human-readable orderId string
    let orderQuery = {}
    if (mongoose.Types.ObjectId.isValid(orderParam)) {
        orderQuery = { _id: new mongoose.Types.ObjectId(orderParam) }
    } else {
        orderQuery = { orderId: orderParam }
    }

    // tenantPlugin auto-scopes findOne
    const order = await OrderModel.findOne(orderQuery).lean()
    if (!order) throw ApiError.notFound('Order not found')

    const settings = await getSettings()
    const vatSettings = settings?.vat
    if (!vatSettings?.rate || vatSettings.rate <= 0) {
        throw ApiError.badRequest('VAT is not configured or rate is 0. Update VAT config first.')
    }
    if (!vatSettings.registrationNumber) {
        throw ApiError.badRequest('VAT registration number (e-BIN) is required before generating invoices.')
    }

    const subtotal = order.subtotal || 0
    const discountAmount = order.discount || 0
    const { taxableAmount, vatAmount } = calculateVat(subtotal, discountAmount, vatSettings.rate)

    // Atomically increment mushakCounter
    const updatedSettings = await SiteSettings.findOneAndUpdate(
        { tenantId: req.tenantId },
        { $inc: { 'vat.mushakCounter': 1 } },
        { new: true },
    )
    const counter = updatedSettings.vat.mushakCounter
    const invoiceNo = generateMushakInvoiceNo(vatSettings.mushakPrefix || 'MSHK', counter)

    const buyerAddress = [order.shippingAddress, order.city].filter(Boolean).join(', ')

    const invoiceData = {
        invoiceNo,
        orderId: order._id,
        invoiceDate: new Date(),
        sellerBin: vatSettings.registrationNumber,
        sellerName: vatSettings.businessName || '',
        sellerAddress: vatSettings.businessAddress || '',
        buyerName: order.customerName || '',
        buyerPhone: order.customerPhone || '',
        buyerAddress,
        buyerBin: req.body?.buyerBin || '',
        items: (order.items || []).map(item => {
            const lineSubtotal = (item.price || 0) * (item.quantity || 1)
            const lineVat = Math.round(lineSubtotal * vatSettings.rate / 100 * 100) / 100
            return {
                name: item.productName || '',
                quantity: item.quantity || 1,
                unitPrice: item.price || 0,
                discountAmount: 0,
                taxableAmount: lineSubtotal,
                vatRate: vatSettings.rate,
                vatAmount: lineVat,
                total: lineSubtotal + lineVat,
            }
        }),
        subtotal,
        discountAmount,
        taxableAmount,
        vatRate: vatSettings.rate,
        vatAmount,
        deliveryCharge: order.deliveryCharge || 0,
        grandTotal: (order.totalAmount || 0) + vatAmount,
        paymentMethod: order.paymentMethod || '',
    }

    // If an invoice already exists for this order, update it (upsert by orderId)
    let invoice
    const existing = await VatInvoiceModel.findOne({ orderId: order._id })
    if (existing) {
        invoice = await VatInvoiceModel.findByIdAndUpdate(
            existing._id,
            { $set: invoiceData },
            { new: true },
        ).lean()
    } else {
        invoice = await VatInvoiceModel.create({ ...invoiceData, tenantId: req.tenantId })
        invoice = invoice.toObject()
    }

    // Update order with VAT fields
    await OrderModel.updateOne(
        { _id: order._id },
        {
            $set: {
                vatAmount,
                vatRate: vatSettings.rate,
                taxableAmount,
                vatInvoiceId: invoice._id,
                vatInvoiceNo: invoiceNo,
            },
        },
    )

    await invalidateSettingsCache()

    return ApiResponse.ok(res, {
        invoice,
        html: generateMushak63Html(invoice),
    }, 'VAT invoice generated')
})

// ── GET /admin/vat/report/mushak91 ───────────────────────────────────────────
// Monthly VAT return summary (Mushak 9.1 format).
export const getMushak91ReportController = asyncHandler(async (req, res) => {
    const { year, month, format } = req.query

    if (!year || !month) throw ApiError.badRequest('year and month query parameters are required')

    const y = parseInt(year, 10)
    const m = parseInt(month, 10)
    if (isNaN(y) || isNaN(m) || m < 1 || m > 12) {
        throw ApiError.badRequest('year must be a valid year and month must be between 1 and 12')
    }

    const dateFrom = new Date(y, m - 1, 1)
    const dateTo = new Date(y, m, 0, 23, 59, 59, 999)

    // tenantPlugin auto-scopes; pull full list for CSV and compute summary
    const invoices = await VatInvoiceModel.find({
        invoiceDate: { $gte: dateFrom, $lte: dateTo },
    })
        .sort({ invoiceDate: 1 })
        .lean()

    const totalVatAmount = invoices.reduce((sum, inv) => sum + (inv.vatAmount || 0), 0)
    const totalTaxableAmount = invoices.reduce((sum, inv) => sum + (inv.taxableAmount || 0), 0)
    const totalGrandTotal = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0)

    const summary = {
        year: y,
        month: m,
        invoiceCount: invoices.length,
        totalTaxableAmount: Math.round(totalTaxableAmount * 100) / 100,
        totalVatAmount: Math.round(totalVatAmount * 100) / 100,
        totalGrandTotal: Math.round(totalGrandTotal * 100) / 100,
    }

    if (format === 'csv') {
        const monthStr = String(m).padStart(2, '0')
        const filename = `mushak91-${y}-${monthStr}.csv`
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

        // BOM for Excel UTF-8 compatibility
        const bom = '﻿'
        const header = 'Invoice No,Date,Buyer Name,Buyer BIN,Taxable Amount,VAT Rate (%),VAT Amount,Grand Total\r\n'
        const rows = invoices.map(inv => {
            const date = new Date(inv.invoiceDate).toLocaleDateString('en-BD')
            const csvEscape = (v) => `"${String(v || '').replace(/"/g, '""')}"`
            return [
                csvEscape(inv.invoiceNo),
                csvEscape(date),
                csvEscape(inv.buyerName),
                csvEscape(inv.buyerBin || ''),
                (inv.taxableAmount || 0).toFixed(2),
                (inv.vatRate || 0).toFixed(2),
                (inv.vatAmount || 0).toFixed(2),
                (inv.grandTotal || 0).toFixed(2),
            ].join(',')
        }).join('\r\n')

        return res.send(bom + header + rows)
    }

    return ApiResponse.ok(res, { summary, invoices }, 'Mushak 9.1 report')
})

// ── GET /client/order/:orderId/vat-invoice ────────────────────────────────────
// Customer-facing: return the HTML invoice for a given order.
// Validates that the requesting phone matches the order phone (no auth required).
export const customerGetVatInvoiceController = asyncHandler(async (req, res) => {
    const { orderId: orderParam } = req.params
    const { phone } = req.query

    let orderQuery = {}
    if (mongoose.Types.ObjectId.isValid(orderParam)) {
        orderQuery = { _id: new mongoose.Types.ObjectId(orderParam) }
    } else {
        orderQuery = { orderId: orderParam }
    }

    const order = await OrderModel.findOne(orderQuery).lean()
    if (!order) throw ApiError.notFound('Order not found')

    // Phone check — require caller to know the phone number on the order
    if (phone && order.customerPhone && String(phone).trim() !== String(order.customerPhone).trim()) {
        throw ApiError.forbidden('Phone number does not match this order')
    }

    if (!order.vatInvoiceId) {
        throw ApiError.notFound('No VAT invoice has been generated for this order yet')
    }

    const invoice = await VatInvoiceModel.findById(order.vatInvoiceId).lean()
    if (!invoice) throw ApiError.notFound('VAT invoice record not found')

    const { format } = req.query
    if (format === 'json') {
        return ApiResponse.ok(res, invoice, 'VAT invoice')
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    return res.send(generateMushak63Html(invoice))
})
