import { Router } from 'express';
import { respond } from '../response.js';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
export function createMiningRouter(gateway) {
    const router = Router();
    router.post('/mine', requireBot(gateway), asyncHandler(async (req, res) => {
        const { blockType, maxDistance = 32 } = req.body ?? {};
        if (typeof blockType !== 'string' || blockType.trim().length === 0) {
            respond.badRequest(res, 'blockType must be a non-empty string');
            return;
        }
        const message = await gateway.mine(blockType, Number(maxDistance) || 32);
        respond.ok(res, undefined, message);
    }));
    return router;
}
