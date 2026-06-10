import { Router } from 'express'
import { backfillProductCodes, createProductController, deleteProductDetails, getProductByCategory, getProductController, getProductDetails, searchProduct, updateProductDetails, updateProductDiscount } from '../controllers/product.controller.js'
import cloudinary_upload, { processAndUploadImages } from '../middlewares/uploadImage.js'
import { requirePermission } from '../middlewares/auth.middleware.js'

const productRouter = Router()

productRouter.post("/upload-product",
    requirePermission('product:write'),
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

productRouter.post('/get-all-product', requirePermission('product:read'), getProductController)
productRouter.post("/get-product-by-category", requirePermission('product:read'), getProductByCategory)
productRouter.post('/get-product-details', requirePermission('product:read'), getProductDetails)

productRouter.put('/update-product-details', requirePermission('product:write'), updateProductDetails)

productRouter.delete('/delete-product', requirePermission('product:delete'), deleteProductDetails)

productRouter.post('/search-product', requirePermission('product:read'), searchProduct)
productRouter.post('/update-discount', requirePermission('product:write'), updateProductDiscount)

// One-time maintenance: generate scannable barcodes/SKUs for legacy products.
productRouter.post('/backfill-codes', requirePermission('product:write'), backfillProductCodes)

export default productRouter