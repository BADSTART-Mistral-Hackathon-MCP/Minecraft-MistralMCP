import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { MineRequest } from '../types';

export function createMiningRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.post('/block', requireBot(bot), asyncHandler(async (req, res) => {
        const { blockType, maxDistance = 32 }: MineRequest = req.body;

        if (typeof blockType !== 'string' || !blockType.trim()) {
            return ResponseHelper.badRequest(res, 'Block type must be a non-empty string');
        }

        try {
            const result = await bot.mine(blockType, maxDistance);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Mining failed');
        }
    }));

    // Future mining endpoints:
    // router.post('/area', ...)
    // router.get('/nearby', ...)
    // router.post('/vein', ...)

    return router;
}