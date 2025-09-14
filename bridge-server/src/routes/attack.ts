import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import { AttackNearestRequest } from '../types';
import { asyncHandler } from '../middleware/error';

export function createAttackRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.post('/nearest', requireBot(bot), asyncHandler(async (req, res) => {
        const { maxDistance = 16, hostileOnly = true }: AttackNearestRequest = req.body;

        if (typeof maxDistance !== 'number' || maxDistance < 1 || maxDistance > 50) {
            return ResponseHelper.badRequest(res, 'Max distance must be a number between 1 and 50');
        }

        try {
            const result = await bot.attackNearestEntity(maxDistance, hostileOnly); // Add await here
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Attack failed');
        }
    }));

    router.post('/stop', requireBot(bot), (req, res) => {
        try {
            const result = bot.stopAttack();
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Stop attack failed');
        }
    });

    router.get('/status', requireBot(bot), (req, res) => {
        try {
            const status = bot.getCombatStatus();
            ResponseHelper.success(res, status);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Status check failed');
        }
    });


    return router;
}