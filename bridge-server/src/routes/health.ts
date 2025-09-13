import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';

export function createHealthRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.get('/', (req, res) => {
        ResponseHelper.success(res, {
            server: 'online',
            bot: bot.isReady() ? 'connected' : 'disconnected'
        }, 'Bridge server is running');
    });

    return router;
}