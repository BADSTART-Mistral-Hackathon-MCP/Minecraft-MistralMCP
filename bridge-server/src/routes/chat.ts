import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import { SayRequest } from '../types';

export function createChatRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.post('/say', requireBot(bot), (req, res) => {
        const { message }: SayRequest = req.body;

        if (typeof message !== 'string' || !message.trim()) {
            return ResponseHelper.badRequest(res, 'Message must be a non-empty string');
        }

        try {
            bot.say(message);
            ResponseHelper.success(res, undefined, `Bot said: ${message}`);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Say failed');
        }
    });

    // Future chat endpoints:
    // router.post('/whisper', ...)
    // router.get('/history', ...)

    return router;
}