import mongoose from 'mongoose';
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const menuItemSchema = new mongoose.Schema(
    {
        label: { type: String, required: true, trim: true },
        url: { type: String, required: true, trim: true },
        icon: { type: String, default: '' },
        openInNewTab: { type: Boolean, default: false },
        order: { type: Number, default: 0 },

        // Self-reference for nested menus (sub-items live in `children`).
        parent: { type: mongoose.Schema.Types.ObjectId, ref: 'NavMenuItem', default: null },

        // Which surface this item appears on.
        location: {
            type: String,
            enum: ['header', 'sidebar', 'mobile', 'footer'],
            default: 'header',
            index: true,
        },

        isVisible: { type: Boolean, default: true },
    },
    { timestamps: true },
);

menuItemSchema.index({ tenantId: 1, location: 1, parent: 1, order: 1 });

menuItemSchema.plugin(tenantPlugin);

export const NavMenuItem = mongoose.model('NavMenuItem', menuItemSchema);
