import { Router } from 'express';
import {
    getPublicPage,
    listPages,
    getAdminPage,
    updatePage,
} from '../controllers/page.controller.js';
import { validate } from '../utils/validate.js';
import { updatePageSchema } from '../validations/page.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const admin = Router();
admin.get('/', requirePermission('content:read'), listPages);
admin.get('/:slug', requirePermission('content:read'), getAdminPage);
admin.put('/:slug', requirePermission('content:write'), validate({ body: updatePageSchema }), updatePage);
admin.patch('/:slug', requirePermission('content:write'), validate({ body: updatePageSchema }), updatePage);

const client = Router();
client.get('/:slug', getPublicPage);

export default { admin, client };
