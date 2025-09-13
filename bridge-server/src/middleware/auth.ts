import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/response';
import MinecraftBot from '../bot';

export function requireBot(bot: MinecraftBot) {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!bot.isReady()) {
            return ResponseHelper.serviceUnavailable(res, 'Bot is not connected or ready');
        }
        next();
    };
}