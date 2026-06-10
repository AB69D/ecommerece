import { Router } from 'express';
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js';
import { deleteHeaderImageController, getHeaderImagesController, uploadHeaderImageController } from '../controllers/header.controller.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const headerRouter = Router();

// single image upload expecting the field 'header_image'
headerRouter.post("/upload-header", requirePermission('header:write'), cloudinary_upload.single("header_image"), processAndUploadImages, uploadHeaderImageController);
headerRouter.get('/get-headers', requirePermission('header:read'), getHeaderImagesController);
headerRouter.delete("/delete-header", requirePermission('header:delete'), deleteHeaderImageController);

export default headerRouter;
