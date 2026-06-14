const getHeaders = (store = "") => {
    const headers = {
        'Content-Type': 'application/json'
    };
    if (typeof window !== 'undefined') {
        const guestId = localStorage.getItem('guestId');
        if (guestId) {
            headers['guest-id'] = guestId;
        }
    }
    if (store) {
        headers['X-Tenant'] = store;
    }
    return headers;
};

const ensureGuestId = () => {
    if (typeof window !== 'undefined') {
        let guestId = localStorage.getItem('guestId');
        if (!guestId) {
            guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            localStorage.setItem('guestId', guestId);
        }
        return guestId;
    }
    return null;
};

export const addToCart = async (productId, quantity = 1, weight = '', weightIndex = 0, price = 0, discountPercent = 0, store = '') => {
    try {
        const guestId = ensureGuestId();
        const res = await fetch(`/api/client/cart/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            body: JSON.stringify({ productId, quantity, weight, weightIndex, price, discountPercent }),
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data, message: data.message };
    } catch (error) {
        console.error('Add to cart error:', error);
        return { success: false, error: error.message };
    }
};

export const getCart = async (store = '') => {
    try {
        const guestId = ensureGuestId();
        const res = await fetch(`/api/client/cart/get`, {
            headers: {
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data: data.data };
    } catch (error) {
        console.error('Get cart error:', error);
        return { success: false, error: error.message };
    }
};

export const updateCartItem = async (itemId, quantity, store = '') => {
    try {
        const guestId = localStorage.getItem('guestId');
        const res = await fetch(`/api/client/cart/update`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            body: JSON.stringify({ itemId, quantity }),
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data: data.data };
    } catch (error) {
        console.error('Update cart error:', error);
        return { success: false, error: error.message };
    }
};

export const removeFromCart = async (itemId, store = '') => {
    try {
        const guestId = localStorage.getItem('guestId');
        const res = await fetch(`/api/client/cart/remove/${itemId}`, {
            method: 'DELETE',
            headers: {
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data: data.data };
    } catch (error) {
        console.error('Remove from cart error:', error);
        return { success: false, error: error.message };
    }
};

export const createOrder = async (orderData, store = '') => {
    try {
        const guestId = localStorage.getItem('guestId');
        const res = await fetch(`/api/client/order/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            body: JSON.stringify(orderData),
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data: data.data, message: data.message };
    } catch (error) {
        console.error('Create order error:', error);
        return { success: false, error: error.message };
    }
};

export const getOrders = async (store = '') => {
    try {
        const guestId = localStorage.getItem('guestId');
        const res = await fetch(`/api/client/order/list`, {
            headers: {
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data: data.data };
    } catch (error) {
        console.error('Get orders error:', error);
        return { success: false, error: error.message };
    }
};

export const getOrder = async (orderId, store = '') => {
    try {
        const guestId = localStorage.getItem('guestId');
        const res = await fetch(`/api/client/order/${orderId}`, {
            headers: {
                'guest-id': guestId,
                ...(store ? { 'X-Tenant': store } : {}),
            },
            credentials: 'include'
        });
        const data = await res.json();
        return { success: data.success, data: data.data };
    } catch (error) {
        console.error('Get order error:', error);
        return { success: false, error: error.message };
    }
};
