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
import { requirePermission } from '../middlewares/auth.middleware.js';

const admin = Router();
admin.get('/', requirePermission('content:read'), listMenuFlat);
admin.get('/tree', requirePermission('content:read'), listMenu);
admin.post('/', requirePermission('content:write'), validate({ body: createMenuItemSchema }), createMenuItem);
admin.post(
    '/reorder',
    requirePermission('content:write'),
    validate({ body: reorderSchema }),
    reorderMenu,
);
admin.patch(
    '/:id',
    requirePermission('content:write'),
    validate({ params: menuIdParam, body: updateMenuItemSchema }),
    updateMenuItem,
);
admin.delete('/:id', requirePermission('content:write'), validate({ params: menuIdParam }), deleteMenuItem);

const client = Router();
client.get('/', listMenu);

export default { admin, client };
