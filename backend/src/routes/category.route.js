import { Router } from 'express'
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js'
import { AddCategoryController, deleteCategoryController, getCategoryController, updateCategoryController } from '../controllers/category.controller.js'
import { requirePermission } from '../middlewares/auth.middleware.js'

const categoryRouter = Router()

categoryRouter.post("/add-category", requirePermission('category:write'), cloudinary_upload.single("category_image"), processAndUploadImages, AddCategoryController)
categoryRouter.get('/get-all-category', requirePermission('category:read'), getCategoryController)
categoryRouter.put('/update-category', requirePermission('category:write'), cloudinary_upload.single("category_image"), processAndUploadImages, updateCategoryController)
categoryRouter.delete("/delete-category", requirePermission('category:delete'), deleteCategoryController)


export default categoryRouter