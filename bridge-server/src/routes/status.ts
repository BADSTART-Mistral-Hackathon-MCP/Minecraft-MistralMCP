import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BotManager } from '../services/BotManager';
import { asyncHandler } from '../middleware/asyncHandler';

export function statusRoutes(botManager: BotManager, io: SocketIOServer): Router {
    const router = Router();

    /**
     * @route GET /status
     * @desc Get current bot status
     * @access Public
     */
    router.get('/status', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const state = botManager.getBotState();
        res.json(state);
    }));

    /**
     * @route GET /status/detailed
     * @desc Get detailed bot status with additional metadata
     * @access Public
     */
    router.get('/status/detailed', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const state = botManager.getBotState();
        const detailedState = {
            ...state,
            server: {
                host: process.env.MINECRAFT_HOST,
                port: process.env.MINECRAFT_PORT,
                version: process.env.MINECRAFT_VERSION
            },
            bot: {
                username: process.env.BOT_USERNAME,
                uptime: botManager.getBotUptime(),
                lastActivity: botManager.getLastActivity()
            },
            capabilities: botManager.getBotCapabilities()
        };

        res.json(detailedState);
    }));

    /**
     * @route GET /status/inventory
     * @desc Get bot inventory details
     * @access Public
     */
    router.get('/status/inventory', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const inventory = botManager.getInventory();
        const summary = botManager.getInventorySummary();

        res.json({
            inventory,
            summary,
            totalItems: inventory.length,
            freeSlots: 36 - inventory.length
        });
    }));

    /**
     * @route GET /status/nearby
     * @desc Get nearby entities and blocks
     * @access Public
     */
    router.get('/status/nearby', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const radius = parseInt(req.query.radius as string) || 16;
        const nearbyData = botManager.getNearbyEntities(radius);

        res.json(nearbyData);
    }));

    return router;
}