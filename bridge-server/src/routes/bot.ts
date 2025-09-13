import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';

export function createBotRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.get('/status', (req, res) => {
        try {
            const status = bot.getStatus();
            ResponseHelper.success(res, status);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Unknown error');
        }
    });

    return router;
}