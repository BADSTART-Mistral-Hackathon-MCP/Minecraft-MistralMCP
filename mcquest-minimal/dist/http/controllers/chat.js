import { Router } from 'express';
import { respond } from '../response.js';
import { requireBot } from '../middleware/requireBot.js';
export function createChatRouter(gateway) {
    const router = Router();
    router.post('/chat', requireBot(gateway), (req, res) => {
        const { message } = req.body ?? {};
        if (typeof message !== 'string' || message.trim().length === 0) {
            respond.badRequest(res, 'message must be a non-empty string');
            return;
        }
        try {
            gateway.say(message);
            respond.ok(res, undefined, `bot said: ${message}`);
        }
        catch (err) {
            respond.error(res, err instanceof Error ? err.message : 'Failed to send chat');
        }
    });
    return router;
}
