import mongoose from 'mongoose'
import { tenantPlugin } from '../tenancy/tenantPlugin.js'

const locationStockSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
  weightIndex: { type: Number, required: true },
  locationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true },
  stock: { type: Number, default: 0, min: 0 },
  reservedQty: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

locationStockSchema.plugin(tenantPlugin)
locationStockSchema.index({ tenantId: 1, productId: 1, weightIndex: 1, locationId: 1 }, { unique: true })
locationStockSchema.index({ tenantId: 1, locationId: 1 })
locationStockSchema.index({ tenantId: 1, productId: 1, weightIndex: 1 })

// Virtual: available stock (cannot go below 0)
locationStockSchema.virtual('available').get(function () {
  return Math.max(0, this.stock - this.reservedQty)
})

export const LocationStockModel = mongoose.model('LocationStock', locationStockSchema)
