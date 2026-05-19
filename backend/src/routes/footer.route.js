import { Router } from 'express';
import { getFooter, updateFooter } from '../controllers/footer.controller.js';
import { validate } from '../utils/validate.js';
import { updateFooterSchema } from '../validations/footer.schema.js';

const admin = Router();
admin.get('/', getFooter);
admin.put('/', validate({ body: updateFooterSchema }), updateFooter);
admin.patch('/', validate({ body: updateFooterSchema }), updateFooter);

const client = Router();
client.get('/', getFooter);

export default { admin, client };
