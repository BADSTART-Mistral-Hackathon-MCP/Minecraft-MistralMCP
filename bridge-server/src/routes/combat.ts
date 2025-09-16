import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BotManager } from '../services/BotManager';
import { asyncHandler } from '../middleware/asyncHandler';

export function combatRoutes(botManager: BotManager, io: SocketIOServer): Router {
    const router = Router();

    /**
     * @route POST /attack
     * @desc Attack a specific entity by ID
     * @access Public
     */
    router.post('/attack', asyncHandler(async (req: Request, res: Response) => {
        const { entityId, continuous = false } = req.body;

        if (!entityId) {
            return res.status(400).json({ error: 'Entity ID is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.attackEntity(entityId, continuous);
        io.emit('attack_performed', { entityId, continuous, result });

        res.json({
            success: true,
            message: `${continuous ? 'Started attacking' : 'Attacked'} entity ${entityId}`,
            entityId,
            continuous,
            details: result
        });
    }));

    /**
     * @route POST /attackNearest
     * @desc Attack the nearest hostile mob
     * @access Public
     */
    router.post('/attackNearest', asyncHandler(async (req: Request, res: Response) => {
        const { mobType, radius = 16, continuous = false } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.attackNearestHostile(mobType, radius, continuous);
        io.emit('nearest_attack', { mobType, radius, continuous, result });

        if (result.target) {
            res.json({
                success: true,
                message: `${continuous ? 'Started attacking' : 'Attacked'} nearest ${result.target.type}`,
                target: result.target,
                continuous,
                details: result
            });
        } else {
            res.json({
                success: false,
                message: `No ${mobType || 'hostile mobs'} found within radius ${radius}`,
                mobType,
                radius
            });
        }
    }));

    /**
     * @route POST /defend
     * @desc Enable/disable defensive mode
     * @access Public
     */
    router.post('/defend', asyncHandler(async (req: Request, res: Response) => {
        const { enabled = true, radius = 8, aggressive = false } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = botManager.setDefensiveMode(enabled, radius, aggressive);
        io.emit('defensive_mode_changed', { enabled, radius, aggressive });

        res.json({
            success: true,
            message: `Defensive mode ${enabled ? 'enabled' : 'disabled'}`,
            enabled,
            radius,
            aggressive,
            details: result
        });
    }));

    /**
     * @route POST /flee
     * @desc Make bot flee from hostile entities
     * @access Public
     */
    router.post('/flee', asyncHandler(async (req: Request, res: Response) => {
        const { distance = 16, direction } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.fleeFromHostiles(distance, direction);
        io.emit('flee_initiated', { distance, direction, result });

        res.json({
            success: true,
            message: `Fleeing from hostile entities`,
            distance,
            direction: result.direction,
            destination: result.destination
        });
    }));

    /**
     * @route POST /shield
     * @desc Raise or lower shield
     * @access Public
     */
    router.post('/shield', asyncHandler(async (req: Request, res: Response) => {
        const { raised = true } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.useShield(raised);
        io.emit('shield_state_changed', { raised, result });

        res.json({
            success: true,
            message: `Shield ${raised ? 'raised' : 'lowered'}`,
            raised,
            details: result
        });
    }));

    /**
     * @route GET /threats
     * @desc Get nearby hostile entities
     * @access Public
     */
    router.get('/threats', asyncHandler(async (req: Request, res: Response) => {
        const radius = parseInt(req.query.radius as string) || 16;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const threats = botManager.getNearbyThreats(radius);

        res.json({
            threats,
            count: threats.length,
            radius,
            dangerLevel: botManager.assessThreatLevel(threats)
        });
    }));

    /**
     * @route GET /combat/status
     * @desc Get current combat status
     * @access Public
     */
    router.get('/combat/status', asyncHandler(async (req: Request, res: Response) => {
        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const status = botManager.getCombatStatus();

        res.json(status);
    }));

    return router;
}