import mongoose from "mongoose";

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

const CategoryModel = mongoose.model('category',categorySchema)

export default CategoryModel