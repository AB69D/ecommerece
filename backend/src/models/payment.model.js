import { Schema, model } from 'mongoose';

// One row per online-payment attempt against an order. The order itself carries
// the authoritative paymentStatus; this collection is the gateway audit trail —
// it captures the references needed to reconcile and to issue refunds
// (bank_tran_id, val_id) plus the raw validation/IPN payloads for debugging.
const paymentSchema = new Schema(
    {
        // Our unique transaction id sent to the gateway as `tran_id`. Unique so a
        // replayed IPN can't create a second row and we can look the attempt up.
        tranId: { type: String, required: true, unique: true, index: true },

        // Link back to the order (human id + Mongo ref) and the buyer.
        orderId: { type: String, required: true, index: true },
        orderRef: { type: String, default: null },
        guestId: { type: String, default: null },
        customerId: { type: String, default: null },

        provider: { type: String, default: 'sslcommerz' },
        sandbox: { type: Boolean, default: true },

        amount: { type: Number, required: true },
        currency: { type: String, default: 'BDT' },

        status: {
            type: String,
            enum: ['initiated', 'paid', 'failed', 'cancelled', 'refunded'],
            default: 'initiated',
            index: true,
        },

        // Gateway references captured on settlement (needed for reconciliation
        // and to issue refunds later).
        valId: { type: String, default: '' },
        bankTranId: { type: String, default: '' },
        cardType: { type: String, default: '' },
        cardIssuer: { type: String, default: '' },
        sessionKey: { type: String, default: '' },
        gatewayUrl: { type: String, default: '' },

        // Raw gateway payloads, kept for audit / dispute resolution.
        validationPayload: { type: Schema.Types.Mixed, default: null },
        ipnPayload: { type: Schema.Types.Mixed, default: null },

        // Populated when an admin issues a refund through the gateway.
        refund: {
            refId: { type: String, default: '' },
            amount: { type: Number, default: 0 },
            status: { type: String, default: '' },
            remarks: { type: String, default: '' },
            at: { type: Date, default: null },
        },
    },
    { timestamps: true },
);

const PaymentModel = model('Payment', paymentSchema);

export default PaymentModel;
