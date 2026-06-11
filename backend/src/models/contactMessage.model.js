import mongoose from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const contactMessageSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    }
}, {
    timestamps: true
})

contactMessageSchema.plugin(tenantPlugin);

// Admin inbox lists newest-first within a tenant.
contactMessageSchema.index({ tenantId: 1, createdAt: -1 });

const ContactMessageModel = mongoose.model("ContactMessage", contactMessageSchema);

export default ContactMessageModel;
