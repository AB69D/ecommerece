import { Router } from 'express';
import CheckoutLeadModel from '../models/checkoutLead.model.js';
import CartModel from '../models/cart.model.js';

// Public route that records a checkout attempt (abandoned-checkout capture).
// The storefront calls this, debounced, as the customer types into the order
// form so the admin can follow up even if the order is never completed.
const clientCheckoutRouter = Router();

const getGuestId = (req) => req.headers['guest-id'] || req.body?.guestId || null;

clientCheckoutRouter.post('/lead', async (req, res) => {
    try {
        const guestId = getGuestId(req);
        if (!guestId) {
            return res.status(400).json({
                message: 'Guest ID required',
                error: true,
                success: false
            });
        }

        const {
            customerName = '',
            customerPhone = '',
            customerEmail = '',
            shippingAddress = '',
            deliveryArea = ''
        } = req.body || {};

        // Don't store empty leads — wait until there's at least a name or phone.
        if (!customerName.trim() && !customerPhone.trim()) {
            return res.json({
                message: 'Nothing to capture yet',
                error: false,
                success: true,
                data: null
            });
        }

        // Snapshot the current cart for context (best-effort).
        let items = [];
        let cartValue = 0;
        let itemCount = 0;
        try {
            const cart = await CartModel.findOne({ guestId });
            if (cart && Array.isArray(cart.items)) {
                items = cart.items.slice(0, 20).map((it) => ({
                    productName: it.productName,
                    productImage: it.productImage,
                    quantity: it.quantity,
                    price: it.price
                }));
                itemCount = cart.items.reduce((s, it) => s + (it.quantity || 0), 0);
                cartValue = cart.totalAmount || 0;
            }
        } catch {
            // ignore cart lookup failures
        }

        const lead = await CheckoutLeadModel.findOneAndUpdate(
            { guestId },
            {
                $set: {
                    customerName: customerName.trim(),
                    customerPhone: customerPhone.trim(),
                    customerEmail: customerEmail.trim(),
                    shippingAddress: shippingAddress.trim(),
                    deliveryArea,
                    items,
                    itemCount,
                    cartValue,
                    lastActivityAt: new Date()
                },
                // Only reset to "abandoned" if this is a brand-new lead; never
                // un-convert a lead that already turned into an order.
                $setOnInsert: { status: 'abandoned' }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        return res.json({
            message: 'Checkout lead captured',
            error: false,
            success: true,
            data: { id: lead._id }
        });
    } catch (error) {
        // Capture is best-effort; never surface an error to the storefront.
        return res.json({
            message: error.message || 'Capture failed',
            error: true,
            success: false,
            data: null
        });
    }
});

export default clientCheckoutRouter;
