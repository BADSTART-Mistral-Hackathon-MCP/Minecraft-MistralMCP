import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';

export function createInventoryRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.get('/', requireBot(bot), (req, res) => {
        try {
            const inventory = bot.getInventory();
            ResponseHelper.success(res, {
                totalItems: inventory.length,
                items: inventory
            });
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Inventory check failed');
        }
    });

    return router;
}