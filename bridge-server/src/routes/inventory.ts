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

    router.post('/drop', requireBot(bot), (req, res) => {
        const { itemName, count = 1 } = req.body;

        if (typeof itemName !== 'string' || !itemName.trim()) {
            return ResponseHelper.badRequest(res, 'Item name must be a non-empty string');
        }
        if (typeof count !== 'number' || count <= 0) {
            return ResponseHelper.badRequest(res, 'Count must be a positive number');
        }

        try {
            const result = bot.dropItem(itemName, count);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Drop item failed');
        }
    });

    return router;

}