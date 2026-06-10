import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            minlength: 3,
            maxlength: 64,
            match: /^[a-z0-9._-]+$/,
        },
        passwordHash: {
            type: String,
            required: true,
            select: false, // never returned by default queries
        },
        email: {
            type: String,
            lowercase: true,
            trim: true,
            sparse: true,
            unique: true,
        },
        fullName: {
            type: String,
            default: "",
            trim: true,
        },
        role: {
            type: String,
            enum: ["super-admin", "admin", "moderator", "salesman"],
            default: "admin",
            index: true,
        },
        // Extra permission grants on top of the role defaults.
        // Each entry is a "resource:action" string (see lib/permissions.js).
        permissions: {
            type: [String],
            default: [],
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        lastLoginAt: {
            type: Date,
        },
        addedBy: {
            type: String,
            default: "system",
        },
    },
    { timestamps: true },
);

const AdminModel = mongoose.model("Admin", adminSchema);

export default AdminModel;
