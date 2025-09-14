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
        const { playerName, distance = 3, continuous = false }: FollowRequest = req.body;

        let targetName = playerName;
        // If no playerName, find nearest player
        if (typeof targetName !== 'string' || !targetName.trim()) {
            const botInstance = bot.getBotInstance();
            if (!botInstance) {
                return ResponseHelper.error(res, 'Bot is not ready');
            }
            let nearest = null;
            let minDist = Infinity;
            const myPos = botInstance.entity.position;
            for (const name in botInstance.players) {
                const p = botInstance.players[name];
                if (p && p.entity && name !== botInstance.username) {
                    const dist = myPos.distanceTo(p.entity.position);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = name;
                    }
                }
            }
            if (!nearest) {
                return ResponseHelper.error(res, 'No players found to follow');
            }
            targetName = nearest;
        }

        try {
            let result = bot.followPlayer(targetName, distance, continuous);
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

    router.post('/lookAtPlayer', requireBot(bot), (req, res) => {
        const { playerName } = req.body;
        if (typeof playerName !== 'string' || !playerName.trim()) {
            return ResponseHelper.badRequest(res, 'Player name must be a non-empty string');
        }

        try {
            const result = bot.lookAtPlayer(playerName);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Look at player failed');
        }
    });

    return router;
}