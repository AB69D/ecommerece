import mongoose, { Schema, model } from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const vatInvoiceItemSchema = new Schema(
    {
        name: { type: String, default: '' },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        discountAmount: { type: Number, default: 0 },
        taxableAmount: { type: Number, default: 0 },
        vatRate: { type: Number, default: 0 },
        vatAmount: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
    },
    { _id: false },
);

const vatInvoiceSchema = new Schema({
    invoiceNo: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null },
    invoiceDate: { type: Date, default: Date.now },

    // Seller (the store / VAT-registered business)
    sellerBin: { type: String, default: '' },
    sellerName: { type: String, default: '' },
    sellerAddress: { type: String, default: '' },

    // Buyer (the customer)
    buyerName: { type: String, default: '' },
    buyerPhone: { type: String, default: '' },
    buyerAddress: { type: String, default: '' },
    buyerBin: { type: String, default: '' }, // optional — B2B buyers only

    // Line items
    items: { type: [vatInvoiceItemSchema], default: [] },

    // Totals
    subtotal: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxableAmount: { type: Number, default: 0 },
    vatRate: { type: Number, default: 0 },
    vatAmount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    paymentMethod: { type: String, default: '' },

    createdAt: { type: Date, default: Date.now },
});

vatInvoiceSchema.plugin(tenantPlugin);

// Unique invoice number per tenant
vatInvoiceSchema.index({ tenantId: 1, invoiceNo: 1 }, { unique: true });
// Fast lookup by order
vatInvoiceSchema.index({ tenantId: 1, orderId: 1 });
// Date-range queries for Mushak 9.1 reports
vatInvoiceSchema.index({ tenantId: 1, invoiceDate: 1 });

const VatInvoiceModel = model('VatInvoice', vatInvoiceSchema);

export default VatInvoiceModel;
