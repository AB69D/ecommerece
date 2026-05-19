import express from 'express';
import { addAdmin, removeAdmin, getAllAdmins } from '../controllers/adminMgmt.controller.js';

const router = express.Router();

router.post('/add', addAdmin);
router.delete('/remove/:id', removeAdmin);
router.get('/all', getAllAdmins);

export default router;
