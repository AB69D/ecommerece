import { Router } from 'express';
import {
    listMenu,
    listMenuFlat,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    reorderMenu,
} from '../controllers/navMenu.controller.js';
import { validate } from '../utils/validate.js';
import {
    createMenuItemSchema,
    updateMenuItemSchema,
    reorderSchema,
    menuIdParam,
} from '../validations/navMenu.schema.js';

const admin = Router();
admin.get('/', listMenuFlat);
admin.get('/tree', listMenu);
admin.post('/', validate({ body: createMenuItemSchema }), createMenuItem);
admin.post(
    '/reorder',
    validate({ body: reorderSchema }),
    reorderMenu,
);
admin.patch(
    '/:id',
    validate({ params: menuIdParam, body: updateMenuItemSchema }),
    updateMenuItem,
);
admin.delete('/:id', validate({ params: menuIdParam }), deleteMenuItem);

const client = Router();
client.get('/', listMenu);

export default { admin, client };
