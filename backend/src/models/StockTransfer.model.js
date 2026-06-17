import mongoose from 'mongoose'
import { tenantPlugin } from '../tenancy/tenantPlugin.js'

const transferItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
  weightIndex: { type: Number, required: true },
  productName: { type: String, required: true },
  weightLabel: { type: String, default: '' },
  requestedQty: { type: Number, required: true, min: 1 },
  shippedQty: { type: Number, default: 0 },
  receivedQty: { type: Number, default: 0 },
}, { _id: false })

const stockTransferSchema = new mongoose.Schema({
  transferNo: { type: String, required: true },
  fromLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  toLocationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  status: { type: String, enum: ['draft', 'in_transit', 'received', 'cancelled'], default: 'draft' },
  items: [transferItemSchema],
  notes: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  shippedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  shippedBy: { type: String, default: '' },
  receivedBy: { type: String, default: '' },
}, { timestamps: true })

stockTransferSchema.plugin(tenantPlugin)
stockTransferSchema.index({ tenantId: 1, status: 1, createdAt: -1 })
stockTransferSchema.index({ tenantId: 1, transferNo: 1 }, { unique: true })

export const StockTransferModel = mongoose.model('StockTransfer', stockTransferSchema)
