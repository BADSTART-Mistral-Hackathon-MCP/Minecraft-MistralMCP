import { Router, Request, Response } from 'express';
import { BotManager } from '../services/BotManager';

export function healthRoutes(botManager: BotManager): Router {
    const router = Router();

    /**
     * @route GET /health
     * @desc System health check
     * @access Public
     */
    router.get('/health', (req: Request, res: Response) => {
        const isConnected = botManager.isConnected();
        const status = isConnected ? 'healthy' : 'degraded';

        res.status(isConnected ? 200 : 503).json({
            status,
            timestamp: new Date().toISOString(),
            services: {
                bot: isConnected ? 'connected' : 'disconnected',
                api: 'running'
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0'
        });
    });

    /**
     * @route GET /healthz
     * @desc Kubernetes-style health check
     * @access Public
     */
    router.get('/healthz', (req: Request, res: Response) => {
        res.status(200).send('OK');
    });

    /**
     * @route GET /readiness
     * @desc Readiness probe - checks if bot is ready to serve requests
     * @access Public
     */
    router.get('/readiness', (req: Request, res: Response) => {
        const isReady = botManager.isConnected();

        if (isReady) {
            res.status(200).json({ status: 'ready' });
        } else {
            res.status(503).json({ status: 'not ready', reason: 'Bot not connected to Minecraft server' });
        }
    });

    return router;
}