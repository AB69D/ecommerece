export const getReviews = async (store = "") => {
    try {
        const res = await fetch(`/api/client/review/reviews`, {
            headers: store ? { 'X-Tenant': store } : {},
        });
        if (!res.ok) {
            return { success: false, error: `HTTP ${res.status}` };
        }
        const text = await res.text();
        const data = JSON.parse(text);
        return { success: data.success, data: data.data };
    } catch (error) {
        console.error('Get reviews error:', error);
        return { success: false, error: null };
    }
};
