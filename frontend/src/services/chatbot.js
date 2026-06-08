// Public storefront chatbot service. Calls the relative API path which Next.js
// rewrites/proxies to the backend, so requests stay same-origin (no CORS).
const ENDPOINT = "/api/client/chatbot/message";

export async function sendChatMessage({ message, action, context, guestId } = {}) {
    const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, action, context, guestId }),
    });
    let json = null;
    try {
        json = await res.json();
    } catch {
        // fall through to error below
    }
    if (!res.ok || !json || json.success === false) {
        throw new Error(json?.message || `Request failed (${res.status})`);
    }
    return json.data;
}
