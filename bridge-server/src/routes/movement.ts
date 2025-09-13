import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { MoveRequest, FollowRequest } from '../types';

export function createMovementRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.post('/moveTo', requireBot(bot), asyncHandler(async (req, res) => {
        const { x, y, z }: MoveRequest = req.body;

        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
            return ResponseHelper.badRequest(res, 'Invalid coordinates. x, y, z must be numbers');
        }

        try {
            const result = await bot.moveTo(x, y, z);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Movement failed');
        }
    }));

    router.post('/follow', requireBot(bot), (req, res) => {
        const { playerName, distance = 3 }: FollowRequest = req.body;

        if (typeof playerName !== 'string' || !playerName.trim()) {
            return ResponseHelper.badRequest(res, 'Player name must be a non-empty string');
        }

        if (typeof distance !== 'number' || distance < 1 || distance > 10) {
            return ResponseHelper.badRequest(res, 'Distance must be a number between 1 and 10');
        }

        try {
            const result = bot.followPlayer(playerName, distance);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Follow failed');
        }
    });

    router.post('/stop', requireBot(bot), (req, res) => {
        try {
            const result = bot.stopMovement();
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Stop failed');
        }
    });

    router.get('/position', requireBot(bot), (req, res) => {
        try {
            const position = bot.getPosition();
            ResponseHelper.success(res, position);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Position check failed');
        }
    });

    return router;
}