import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../lib/ApiResponse.js';
import { handleTurn } from '../services/chatbot.engine.js';

// POST /api/client/chatbot/message
// Public, stateless conversational endpoint. The client passes the current
// conversation `context` (and an optional `message` or structured `action`);
// the engine returns the bot reply, an updated context to echo back, product
// cards, a live cart snapshot and — when an order is placed — the order.
export const postChatMessage = asyncHandler(async (req, res) => {
    const { message, action, context, guestId } = req.body || {};
    const result = await handleTurn({ message, action, context, guestId });
    return ok(res, result, 'OK');
});
