import { Router } from 'express';
import {
    getPublicSettings,
    getAdminSettings,
    updateSettings,
    uploadSettingsImage,
} from '../controllers/siteSettings.controller.js';
import { validate } from '../utils/validate.js';
import { updateSiteSettingsSchema } from '../validations/siteSettings.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js';

const admin = Router();
admin.get('/', requirePermission('content:read'), getAdminSettings);
admin.put('/', requirePermission('content:write'), validate({ body: updateSiteSettingsSchema }), updateSettings);
admin.patch('/', requirePermission('content:write'), validate({ body: updateSiteSettingsSchema }), updateSettings);
admin.post(
    '/upload',
    requirePermission('content:write'),
    cloudinary_upload.single('image'),
    processAndUploadImages,
    uploadSettingsImage,
);

const client = Router();
client.get('/', getPublicSettings);

export default { admin, client };
