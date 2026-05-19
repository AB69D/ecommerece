import { Router } from 'express'
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js'
import { AddCategoryController, deleteCategoryController, getCategoryController, updateCategoryController } from '../controllers/category.controller.js'

const categoryRouter = Router()

categoryRouter.post("/add-category", cloudinary_upload.single("category_image"), processAndUploadImages, AddCategoryController)
categoryRouter.get('/get-all-category', getCategoryController)
categoryRouter.put('/update-category', cloudinary_upload.single("category_image"), processAndUploadImages, updateCategoryController)
categoryRouter.delete("/delete-category", deleteCategoryController)


export default categoryRouter