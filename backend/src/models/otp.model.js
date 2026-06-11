import mongoose from "mongoose";
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    code: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
})

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

otpSchema.plugin(tenantPlugin);

// OTP verification looks up by email within a tenant.
otpSchema.index({ tenantId: 1, email: 1 })

const OtpModel = mongoose.model('Otp', otpSchema)

export default OtpModel
