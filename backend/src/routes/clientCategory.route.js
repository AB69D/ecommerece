import { Router } from 'express'
import { getCategoryController } from '../controllers/category.controller.js'

const clientCategoryRouter = Router()

clientCategoryRouter.get('/get-all-category', getCategoryController)

export default clientCategoryRouter
