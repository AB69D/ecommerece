import multer from "multer";
import sharp from "sharp";
import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { ApiError } from "../lib/ApiError.js";
import { getEffectiveTenantId } from "../tenancy/tenantContext.js";

// 1. Multer memory storage: buffer the upload in RAM (bounded) so we can hand the
//    raw bytes to sharp. Caps file size/count and rejects non-images up front.
const storage = multer.memoryStorage();
const IMAGE_MIME = /^image\/(jpe?g|png|webp|gif|avif|heic|heif)$/i;
const MAX_FILE_BYTES = 12 * 1024 * 1024; // 12 MB per ORIGINAL upload (we shrink it)
const cloudinary_upload = multer({
    storage,
    limits: { fileSize: MAX_FILE_BYTES, files: 12 },
    fileFilter: (req, file, cb) => {
        if (IMAGE_MIME.test(file.mimetype)) cb(null, true);
        else cb(ApiError.badRequest(`Unsupported file type "${file.mimetype}". Please upload an image (JPEG, PNG, WebP, GIF, AVIF).`));
    },
});

// ── Local image store (on the VPS) ──────────────────────────────────────────
// Images live on a persistent volume, NOT an external CDN. Each store's files go
// in their own tenant folder so a backup/export stays self-contained. Files are
// served read-only by the API at /api/uploads/<tenantId>/<file> (see server.js),
// which the storefront reaches over HTTPS through the same /api proxy.
const UPLOADS_ROOT = process.env.UPLOADS_DIR || "/app/uploads";
const MAX_DIM = 2000; // longest edge; keeps high resolution without huge files
const WEBP_QUALITY = 85; // near-original quality, big size win vs JPEG/PNG

const processFile = async (file) => {
    // Stamp into the CURRENT store's folder. Admin uploads run under the store's
    // token context, so this is that store's tenantId.
    const tenantId = String(getEffectiveTenantId() || "shared");
    const dir = path.join(UPLOADS_ROOT, tenantId);
    await fs.mkdir(dir, { recursive: true });

    const name = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.webp`;
    const outPath = path.join(dir, name);

    // Compress: respect EXIF orientation, fit inside MAX_DIM (never upscale),
    // re-encode as WebP. One pipeline, streamed straight to disk.
    await sharp(file.buffer)
        .rotate()
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toFile(outPath);

    // Relative, same-origin URL — loads over HTTPS via the storefront's /api proxy
    // and needs no backend domain. Controllers read file.path unchanged.
    file.path = `/api/uploads/${tenantId}/${name}`;
    return file;
};

// 2. Compress + persist every uploaded image, then continue to the controller.
export const processAndUploadImages = async (req, res, next) => {
    try {
        if (req.file) {
            await processFile(req.file);
        } else if (req.files) {
            const all = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();
            await Promise.all(all.map((file) => processFile(file)));
        }
        next();
    } catch (error) {
        console.error("Image Processing Error:", error);
        return res.status(500).json({
            message: "Failed to process image",
            error: true,
            success: false,
        });
    }
};

export default cloudinary_upload;
