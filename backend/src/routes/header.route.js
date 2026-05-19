import { Router } from 'express';
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js';
import { deleteHeaderImageController, getHeaderImagesController, uploadHeaderImageController } from '../controllers/header.controller.js';

const headerRouter = Router();

// single image upload expecting the field 'header_image'
headerRouter.post("/upload-header", cloudinary_upload.single("header_image"), processAndUploadImages, uploadHeaderImageController);
headerRouter.get('/get-headers', getHeaderImagesController);
headerRouter.delete("/delete-header", deleteHeaderImageController);

export default headerRouter;
