import ContactMessageModel from '../models/contactMessage.model.js';

export const submitContactMessage = async (request, response) => {
    try {
        const { name, email, subject, message } = request.body;

        if (!name || !email || !subject || !message) {
            return response.status(400).json({
                message: "All fields are required",
                error: true,
                success: false
            });
        }

        const contactMessage = new ContactMessageModel({
            name,
            email,
            subject,
            message
        });

        await contactMessage.save();

        return response.status(201).json({
            message: "Message sent successfully",
            error: false,
            success: true,
            data: contactMessage
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
};

export const getAllContactMessages = async (request, response) => {
    try {
        const messages = await ContactMessageModel.find().sort({ createdAt: -1 });

        return response.status(200).json({
            message: "Messages fetched successfully",
            error: false,
            success: true,
            data: messages
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
};

export const deleteContactMessage = async (request, response) => {
    try {
        const { id } = request.params;

        const deletedMessage = await ContactMessageModel.findByIdAndDelete(id);

        if (!deletedMessage) {
            return response.status(404).json({
                message: "Message not found",
                error: true,
                success: false
            });
        }

        return response.status(200).json({
            message: "Message deleted successfully",
            error: false,
            success: true
        });

    } catch (error) {
        return response.status(500).json({
            message: error.message || "Internal server error",
            error: true,
            success: false
        });
    }
};
