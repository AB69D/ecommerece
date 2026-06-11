import mongoose from "mongoose";
import { tenantPlugin } from '../tenancy/tenantPlugin.js';

const categorySchema = new mongoose.Schema({
    category_name : {
        type : String
    },
    category_image : {
        type : String
    }
},{
    timestamps : true
})

categorySchema.plugin(tenantPlugin);

const CategoryModel = mongoose.model('category',categorySchema)

export default CategoryModel