import AdminModel from "../models/admin.model.js";

export const addAdmin = async (request, response) => {
    try {
        const { email } = request.body;

        if (!email) {
            return response.status(400).json({
                message: "Email is required",
                error: true,
                success: false
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existing = await AdminModel.findOne({ email: normalizedEmail });
        if (existing) {
            return response.status(409).json({
                message: "This email is already an admin",
                error: true,
                success: false
            });
        }

        const admin = new AdminModel({
            email: normalizedEmail,
            addedBy: request.admin.email
        });
        await admin.save();

        return response.status(201).json({
            message: "Admin added successfully",
            error: false,
            success: true,
            data: admin
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const removeAdmin = async (request, response) => {
    try {
        const { id } = request.params;

        const admin = await AdminModel.findByIdAndDelete(id);

        if (!admin) {
            return response.status(404).json({
                message: "Admin not found",
                error: true,
                success: false
            });
        }

        return response.json({
            message: "Admin removed successfully",
            error: false,
            success: true
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};

export const getAllAdmins = async (request, response) => {
    try {
        const admins = await AdminModel.find().sort({ createdAt: -1 });

        return response.json({
            message: "Admins fetched successfully",
            error: false,
            success: true,
            data: admins
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || error,
            error: true,
            success: false
        });
    }
};
