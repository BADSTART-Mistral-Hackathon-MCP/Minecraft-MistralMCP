import { Router } from 'express';
import { respond } from '../response.js';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
export function createCraftingRouter(gateway) {
    const router = Router();
    router.post('/craft', requireBot(gateway), asyncHandler(async (req, res) => {
        const { item, count = 1 } = req.body ?? {};
        if (typeof item !== 'string' || item.trim().length === 0) {
            respond.badRequest(res, 'item must be a non-empty string');
            return;
        }
        const message = await gateway.craft(item, Number(count) || 1);
        respond.ok(res, undefined, message);
    }));
    return router;
}
