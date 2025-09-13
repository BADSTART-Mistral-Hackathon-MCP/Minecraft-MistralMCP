import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { CraftRequest } from '../types';

export function createCraftingRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.post('/item', requireBot(bot), asyncHandler(async (req, res) => {
        const { item, count = 1 }: CraftRequest = req.body;

        if (typeof item !== 'string' || !item.trim()) {
            return ResponseHelper.badRequest(res, 'Item must be a non-empty string');
        }

        try {
            const result = await bot.craft(item, count);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Crafting failed');
        }
    }));

    // Future crafting endpoints:
    // router.get('/recipes', ...)
    // router.post('/recipe', ...)
    // router.get('/materials', ...)

    return router;
}