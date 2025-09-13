import express from 'express';
import cors from 'cors';
import MinecraftBot from './bot';
import { ApiResponse, MoveRequest, SayRequest, MineRequest, CraftRequest } from './types';

export function createApiServer(bot: MinecraftBot) {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Error wrapper
    const asyncHandler = (fn: Function) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

    // Bot ready middleware
    const requireBot = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        if (!bot.isReady()) {
            return res.status(503).json({
                success: false,
                error: 'Bot is not connected or ready'
            } as ApiResponse);
        }
        next();
    };

    // Routes
    app.get('/health', (req, res) => {
        res.json({
            success: true,
            message: 'Bridge server is running',
            data: {
                server: 'online',
                bot: bot.isReady() ? 'connected' : 'disconnected'
            }
        } as ApiResponse);
    });

    app.get('/status', (req, res) => {
        try {
            const status = bot.getStatus();
            res.json({
                success: true,
                data: status
            } as ApiResponse);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            } as ApiResponse);
        }
    });

    app.post('/move', requireBot, asyncHandler(async (req: express.Request, res: express.Response) => {
        const { x, y, z }: MoveRequest = req.body;

        if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
            return res.status(400).json({
                success: false,
                error: 'Invalid coordinates. x, y, z must be numbers'
            } as ApiResponse);
        }

        try {
            const result = await bot.moveTo(x, y, z);
            res.json({
                success: true,
                message: result
            } as ApiResponse);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Movement failed'
            } as ApiResponse);
        }
    }));

    app.post('/say', requireBot, (req, res) => {
        const { message }: SayRequest = req.body;

        if (typeof message !== 'string' || !message.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Message must be a non-empty string'
            } as ApiResponse);
        }

        try {
            bot.say(message);
            res.json({
                success: true,
                message: `Bot said: ${message}`
            } as ApiResponse);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Say failed'
            } as ApiResponse);
        }
    });

    app.post('/mine', requireBot, asyncHandler(async (req: express.Request, res: express.Response) => {
        const { blockType, maxDistance = 32 }: MineRequest = req.body;

        if (typeof blockType !== 'string' || !blockType.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Block type must be a non-empty string'
            } as ApiResponse);
        }

        try {
            const result = await bot.mine(blockType, maxDistance);
            res.json({
                success: true,
                message: result
            } as ApiResponse);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Mining failed'
            } as ApiResponse);
        }
    }));

    app.post('/craft', requireBot, asyncHandler(async (req: express.Request, res: express.Response) => {
        const { item, count = 1 }: CraftRequest = req.body;

        if (typeof item !== 'string' || !item.trim()) {
            return res.status(400).json({
                success: false,
                error: 'Item must be a non-empty string'
            } as ApiResponse);
        }

        try {
            const result = await bot.craft(item, count);
            res.json({
                success: true,
                message: result
            } as ApiResponse);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Crafting failed'
            } as ApiResponse);
        }
    }));

    app.get('/inventory', requireBot, (req, res) => {
        try {
            const inventory = bot.getInventory();
            res.json({
                success: true,
                data: {
                    totalItems: inventory.length,
                    items: inventory
                }
            } as ApiResponse);
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Inventory check failed'
            } as ApiResponse);
        }
    });

    // Error handling middleware
    app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.error('API Error:', err);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        } as ApiResponse);
    });

    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        } as ApiResponse);
    });

    return app;
}