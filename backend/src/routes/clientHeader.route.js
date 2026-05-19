import { Router } from 'express';
import { getHeaderImagesController } from '../controllers/header.controller.js';

const clientHeaderRouter = Router();

clientHeaderRouter.get('/headers', getHeaderImagesController);

export default clientHeaderRouter;