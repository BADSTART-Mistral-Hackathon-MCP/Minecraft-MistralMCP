import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BotManager } from '../services/BotManager';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateMovementInput } from '../middleware/validation';

export function movementRoutes(botManager: BotManager, io: SocketIOServer): Router {
    const router = Router();

    /**
     * @route POST /moveTo
     * @desc Move bot to specific coordinates
     * @access Public
     */
    router.post('/moveTo', validateMovementInput, asyncHandler(async (req: Request, res: Response) => {
        const { x, y, z } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        await botManager.moveTo(x, y, z);
        io.emit('goal_set', { x, y, z, type: 'moveTo' });

        res.json({
            success: true,
            message: `Moving to coordinates ${x}, ${y}, ${z}`,
            destination: { x, y, z }
        });
    }));

    /**
     * @route POST /followPlayer
     * @desc Follow a specific player
     * @access Public
     */
    router.post('/followPlayer', asyncHandler(async (req: Request, res: Response) => {
        const { username, distance = 2 } = req.body;

        if (!username) {
            return res.status(400).json({ error: 'Username is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        await botManager.followPlayer(username, distance);
        io.emit('follow_started', { username, distance });

        res.json({
            success: true,
            message: `Following ${username} at distance ${distance}`,
            target: username,
            distance
        });
    }));

    /**
     * @route POST /goTo
     * @desc Go to a named location or landmark
     * @access Public
     */
    router.post('/goTo', asyncHandler(async (req: Request, res: Response) => {
        const { location, type = 'nearest' } = req.body;

        if (!location) {
            return res.status(400).json({ error: 'Location is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.goToLocation(location, type);
        io.emit('navigation_started', { location, type, destination: result });

        res.json({
            success: true,
            message: `Navigating to ${location}`,
            location,
            destination: result
        });
    }));

    /**
     * @route POST /stop
     * @desc Stop current movement
     * @access Public
     */
    router.post('/stop', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        botManager.stopMovement();
        io.emit('movement_stopped');

        res.json({
            success: true,
            message: 'Movement stopped'
        });
    }));

    /**
     * @route GET /path
     * @desc Get current path information
     * @access Public
     */
    router.get('/path', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const pathInfo = botManager.getCurrentPath();
        res.json(pathInfo);
    }));

    /**
     * @route POST /lookAt
     * @desc Make bot look at specific coordinates or entity
     * @access Public
     */
    router.post('/lookAt', asyncHandler(async (req: Request, res: Response) => {
        const { x, y, z, entityId } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        if (entityId) {
            await botManager.lookAtEntity(entityId);
            res.json({ success: true, message: `Looking at entity ${entityId}` });
        } else if (x !== undefined && y !== undefined && z !== undefined) {
            await botManager.lookAt(x, y, z);
            res.json({ success: true, message: `Looking at ${x}, ${y}, ${z}` });
        } else {
            return res.status(400).json({ error: 'Either coordinates (x,y,z) or entityId is required' });
        }
    }));

    return router;
}