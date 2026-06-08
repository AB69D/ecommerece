import { Router } from 'express';
import { getFooter, updateFooter } from '../controllers/footer.controller.js';
import { validate } from '../utils/validate.js';
import { updateFooterSchema } from '../validations/footer.schema.js';
import { requirePermission } from '../middlewares/auth.middleware.js';

const admin = Router();
admin.get('/', requirePermission('content:read'), getFooter);
admin.put('/', requirePermission('content:write'), validate({ body: updateFooterSchema }), updateFooter);
admin.patch('/', requirePermission('content:write'), validate({ body: updateFooterSchema }), updateFooter);

const client = Router();
client.get('/', getFooter);

export default { admin, client };
