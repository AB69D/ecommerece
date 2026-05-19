import { Router } from 'express';
import CartModel from '../models/cart.model.js';
import ProductModel from '../models/product.model.js';

const clientCartRouter = Router();

const getGuestId = (req) => {
    return req.headers['guest-id'] || null;
};

clientCartRouter.get('/get', async (req, res) => {
    try {
        let guestId = getGuestId(req);
        if (!guestId) {
            guestId = `guest_${Date.now()}`;
        }

        let cart = await CartModel.findOne({ guestId });

        if (!cart) {
            cart = new CartModel({
                guestId: guestId,
                items: [],
                totalAmount: 0
            });
            await cart.save();
        }

        res.setHeader('guest-id', guestId);
        
        res.json({
            message: "Cart data",
            data: cart,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Cart get error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

clientCartRouter.post('/add', async (req, res) => {
    try {
        const { productId, productName, productImage, quantity = 1, weight, weightIndex = 0, price, discountPercent = 0 } = req.body;
        let guestId = getGuestId(req);
        
        // Ensure weightIndex is a number
        const weightIdx = Number(weightIndex) || 0;
        const qty = Number(quantity) || 1;
        
        if (!guestId) {
            guestId = `guest_${Date.now()}`;
        }

        if (!productId || !price) {
            return res.status(400).json({
                message: "Product ID and price are required",
                error: true,
                success: false
            });
        }

        // Check stock before adding - convert productId to ObjectId if needed
        const product = await ProductModel.findById(productId);
        
        if (!product || !product.weights || !product.weights[weightIdx]) {
            return res.status(400).json({
                message: "Product or weight variant not found",
                error: true,
                success: false
            });
        }

        const availableStock = product.weights[weightIdx]?.stock || 0;
        if (availableStock < qty) {
            return res.status(400).json({
                message: `Only ${availableStock} items available in stock`,
                error: true,
                success: false
            });
        }

        let cart = await CartModel.findOne({ guestId });
        
        if (!cart) {
            cart = new CartModel({
                guestId: guestId,
                items: [],
                totalAmount: 0
            });
        }

        // Clean up old items - check if any item has old 'product' field
        const hasOldFormat = cart.items.some(item => item.product && !item.productId);
        if (hasOldFormat) {
            await CartModel.deleteOne({ guestId });
            cart = new CartModel({
                guestId: guestId,
                items: [],
                totalAmount: 0
            });
        }

        // Check if item already exists with same productId and weightIndex
        const existingItemIndex = cart.items.findIndex(
            item => item.productId === productId && item.weightIndex === weightIdx
        );

        let newQuantity = qty;
        if (existingItemIndex > -1) {
            newQuantity = cart.items[existingItemIndex].quantity + qty;
            // Check stock for total quantity
            const currentStock = product.weights[weightIdx]?.stock || 0;
            if (newQuantity > currentStock) {
                return res.status(400).json({
                    message: `Only ${currentStock} items available. You already have ${cart.items[existingItemIndex].quantity} in cart.`,
                    error: true,
                    success: false
                });
            }
            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].discountPercent = discountPercent || 0;
        } else {
            cart.items.push({
                productId: productId,
                productName: productName || '',
                productImage: productImage || '',
                quantity: qty,
                weight: weight || '',
                weightIndex: weightIdx,
                price: price,
                discountPercent: discountPercent || 0
            });
        }

        // Recalculate total - each item price * quantity (after discount)
        cart.totalAmount = cart.items.reduce((total, item) => {
            const discountedPrice = item.price - (item.price * (item.discountPercent || 0) / 100);
            return total + (discountedPrice * item.quantity);
        }, 0);

        await cart.save();

        res.setHeader('guest-id', guestId);

        res.json({
            message: "Product added to cart",
            data: cart,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Cart add error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

clientCartRouter.put('/update', async (req, res) => {
    try {
        const { itemId, quantity } = req.body;
        const guestId = getGuestId(req);

        if (!guestId) {
            return res.status(400).json({
                message: "Guest ID required",
                error: true,
                success: false
            });
        }

        const cart = await CartModel.findOne({ guestId });
        if (!cart) {
            return res.status(404).json({
                message: "Cart not found",
                error: true,
                success: false
            });
        }

        const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
        if (itemIndex > -1) {
            const cartItem = cart.items[itemIndex];
            const newQty = Number(quantity) || 0;
            
            // Check stock availability when increasing quantity
            if (newQty > cartItem.quantity) {
                const product = await ProductModel.findById(cartItem.productId);
                if (product && product.weights && product.weights[cartItem.weightIndex] !== undefined) {
                    const availableStock = product.weights[cartItem.weightIndex]?.stock || 0;
                    if (newQty > availableStock) {
                        return res.status(400).json({
                            message: `Only ${availableStock} items available in stock`,
                            error: true,
                            success: false
                        });
                    }
                }
            }
            
            if (newQty > 0) {
                cart.items[itemIndex].quantity = newQty;
            } else {
                cart.items.splice(itemIndex, 1);
            }
            cart.totalAmount = cart.items.reduce((total, item) => {
                const discountedPrice = item.price - (item.price * (item.discountPercent || 0) / 100);
                return total + (discountedPrice * item.quantity);
            }, 0);
            await cart.save();
        }

        res.json({
            message: "Cart updated",
            data: cart,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Cart update error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

clientCartRouter.delete('/remove/:itemId', async (req, res) => {
    try {
        const { itemId } = req.params;
        const guestId = getGuestId(req);

        if (!guestId) {
            return res.status(400).json({
                message: "Guest ID required",
                error: true,
                success: false
            });
        }

        const cart = await CartModel.findOne({ guestId });
        if (!cart) {
            return res.status(404).json({
                message: "Cart not found",
                error: true,
                success: false
            });
        }

        cart.items = cart.items.filter(item => item._id.toString() !== itemId);
        cart.totalAmount = cart.items.reduce((total, item) => {
            const discountedPrice = item.price - (item.price * (item.discountPercent || 0) / 100);
            return total + (discountedPrice * item.quantity);
        }, 0);
        await cart.save();

        res.json({
            message: "Item removed from cart",
            data: cart,
            error: false,
            success: true
        });
    } catch (error) {
        console.error('Cart remove error:', error);
        res.status(500).json({
            message: error.message,
            error: true,
            success: false
        });
    }
});

export default clientCartRouter;