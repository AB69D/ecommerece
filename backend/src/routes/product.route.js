import { Router } from 'express'
import { createProductController, deleteProductDetails, getProductByCategory, getProductController, getProductDetails, searchProduct, updateProductDetails, updateProductDiscount } from '../controllers/product.controller.js'
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js'

const productRouter = Router()

productRouter.post("/upload-product", 
    cloudinary_upload.fields([
        { name: 'cover_image', maxCount: 1 },
        { name: 'weight_images_0', maxCount: 10 },
        { name: 'weight_images_1', maxCount: 10 },
        { name: 'weight_images_2', maxCount: 10 },
        { name: 'weight_images_3', maxCount: 10 },
        { name: 'weight_images_4', maxCount: 10 },
        { name: 'weight_images_5', maxCount: 10 },
        { name: 'weight_images_6', maxCount: 10 },
        { name: 'weight_images_7', maxCount: 10 },
        { name: 'weight_images_8', maxCount: 10 },
        { name: 'weight_images_9', maxCount: 10 }
    ]), 
    processAndUploadImages, 
    createProductController
)

productRouter.post('/get-all-product', getProductController)
productRouter.post("/get-product-by-category", getProductByCategory)
productRouter.post('/get-product-details', getProductDetails)

productRouter.put('/update-product-details', updateProductDetails)

productRouter.delete('/delete-product', deleteProductDetails)

productRouter.post('/search-product', searchProduct)
productRouter.post('/update-discount', updateProductDiscount)

export default productRouter