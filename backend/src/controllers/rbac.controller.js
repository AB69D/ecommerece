import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import {
    PERMISSION_GROUPS,
    ALL_PERMISSIONS,
    ROLES,
    ROLE_PERMISSIONS,
} from '../lib/permissions.js';

// Returns the full RBAC catalog so the admin UI can render a permission
// matrix and show what each role grants by default.
export const getCatalog = asyncHandler(async (_req, res) => {
    return ok(
        res,
        {
            groups: PERMISSION_GROUPS,
            permissions: ALL_PERMISSIONS,
            roles: ROLES,
            rolePermissions: ROLE_PERMISSIONS,
        },
        'RBAC catalog',
    );
});
