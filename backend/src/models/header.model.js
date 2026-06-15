import mongoose from "mongoose";
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const headerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    },
    url: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

headerSchema.index({ tenantId: 1, createdAt: -1 });

headerSchema.plugin(tenantPlugin);

const HeaderModel = mongoose.model('header', headerSchema);

export default HeaderModel;
