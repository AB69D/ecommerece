import HeaderModel from "../models/header.model.js";

export const uploadHeaderImageController = async (req, res) => {
    try {
        const { url } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({
                message: "Please upload an image",
                error: true,
                success: false
            });
        }

        const newHeader = new HeaderModel({
            image: file.path, 
            url: url || ""
        });

        const saved = await newHeader.save();

        return res.json({
            message: "Header image uploaded successfully",
            data: saved,
            success: true,
            error: false
        });

    } catch (error) {
        return res.status(500).json({
            message: error.message || "Internal Server Error",
            error: true,
            success: false
        });
    }
};

export const getHeaderImagesController = async (req, res) => {
    try {
        const data = await HeaderModel.find().sort({ createdAt: -1 });

        return res.json({
            data: data,
            error: false,
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const deleteHeaderImageController = async (req, res) => {
    try {
        const { _id } = req.body;

        const deleted = await HeaderModel.deleteOne({ _id: _id });

        return res.json({
            message: "Header image deleted successfully",
            data: deleted,
            error: false,
            success: true
        });
    } catch (error) {
        return res.status(500).json({
            message: error.message || error,
            success: false,
            error: true
        });
    }
};
