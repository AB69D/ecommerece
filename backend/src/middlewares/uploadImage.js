import multer from "multer";
import cloudinary from "../config/cloudinary.js";

// 1. Configure multer to use memory storage instead of uploading directly
const storage = multer.memoryStorage();
const cloudinary_upload = multer({ storage });

// 2. Upload middleware
export const processAndUploadImages = async (req, res, next) => {
    try {
        const uploadStream = (buffer) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: "Gram2ghor", format: "webp" },
                    (error, result) => {
                        if (result) resolve(result);
                        else reject(error);
                    }
                );
                stream.end(buffer);
            });
        };

        const processFile = async (file) => {
            const result = await uploadStream(file.buffer);
            
            // Mutate the file object so the controllers can continue cleanly
            // They expect 'file.path' to contain the Cloudinary URL.
            file.path = result.secure_url;
            return file;
        };

        if (req.file) {
            await processFile(req.file);
        } else if (req.files) {
            // Handle object format from cloudinary_upload.fields()
            if (Array.isArray(req.files)) {
                await Promise.all(req.files.map(file => processFile(file)));
            } else {
                // Handle object with field names as keys
                const fileArrays = Object.values(req.files);
                const allFiles = fileArrays.flat();
                await Promise.all(allFiles.map(file => processFile(file)));
            }
        }

        next();
    } catch (error) {
        console.error("Image Processing Error:", error);
        return res.status(500).json({
            message: "Failed to upload image",
            error: true,
            success: false
        });
    }
};

export default cloudinary_upload;
