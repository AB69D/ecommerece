import { Router } from 'express';
import {
    getPublicSettings,
    getAdminSettings,
    updateSettings,
} from '../controllers/siteSettings.controller.js';
import { validate } from '../utils/validate.js';
import { updateSiteSettingsSchema } from '../validations/siteSettings.schema.js';

const admin = Router();
admin.get('/', getAdminSettings);
admin.put('/', validate({ body: updateSiteSettingsSchema }), updateSettings);
admin.patch('/', validate({ body: updateSiteSettingsSchema }), updateSettings);

const client = Router();
client.get('/', getPublicSettings);

export default { admin, client };
