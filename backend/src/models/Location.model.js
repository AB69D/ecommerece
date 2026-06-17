import mongoose from 'mongoose'
import { tenantPlugin } from '../tenancy/tenantPlugin.js'

const locationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  type: { type: String, enum: ['warehouse', 'store', 'outlet', 'depot'], default: 'warehouse' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  phone: { type: String, default: '' },
  managerName: { type: String, default: '' },
  active: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
}, { timestamps: true })

locationSchema.plugin(tenantPlugin)
locationSchema.index({ tenantId: 1, code: 1 }, { unique: true })
locationSchema.index({ tenantId: 1, active: 1 })

export const LocationModel = mongoose.model('Location', locationSchema)
