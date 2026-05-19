import mongoose from 'mongoose';

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

menuItemSchema.index({ location: 1, parent: 1, order: 1 });

export const NavMenuItem = mongoose.model('NavMenuItem', menuItemSchema);
