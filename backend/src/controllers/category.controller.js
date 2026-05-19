import CategoryModel from "../models/category.model.js";


export const AddCategoryController = async (req, res) => {
    try {

        const { category_name } = req.body;
        const file = req.file;
        console.log(`category_name: ${category_name}`)
        console.log(`file: ${file}`)

        if (!category_name || !file) {
            return res.status(400).json({
                message: "Enter required fields",
                error: true,
                success: false
            });
        }

        const category = new CategoryModel({
            category_name,
            category_image: file.path
        });

        const saved = await category.save();

        return res.json({
            message: "Add Category Successfully",
            data: saved,
            success: true,
            error: false
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: error.message || "Internal Server Error",
            error: true,
            success: false
        });
    }
};
export const getCategoryController = async (request, response) => {
    try {

        const data = await CategoryModel.find().sort({ createdAt: -1 })

        return response.json({
            data: data,
            error: false,
            success: true
        })
    } catch (error) {
        return response.status(500).json({
            message: error.messsage || error,
            error: true,
            success: false
        })
    }
};

export const updateCategoryController = async (request, response) => {
    try {
        const { _id, category_name, category_image } = request.body

        let updateData = {};
        if (category_name) updateData.category_name = category_name;
        
        const file = request.file;
        if (file) {
            updateData.category_image = file.path;
        } else if (category_image) {
            updateData.category_image = category_image;
        }

        const update = await CategoryModel.updateOne({
            _id: _id
        }, updateData)

        return response.json({
            message: "Updated Category Successfully",
            success: true,
            error: false,
            data: update
        })
    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        })
    }
};

export const deleteCategoryController = async (request, response) => {
    try {
        const { _id } = request.body

        const deleteCategory = await CategoryModel.deleteOne({ _id: _id })

        return response.json({
            message: "Delete category successfully",
            data: deleteCategory,
            error: false,
            success: true
        })

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            success: false,
            error: true
        })
    }
};