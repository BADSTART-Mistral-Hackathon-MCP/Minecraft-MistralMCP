import { Router } from 'express';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createSentinelController } from './sentinel.js';
export function createSentinelRouter(gateway) {
    const router = Router();
    const controller = createSentinelController(gateway);
    // Sentinel mode control
    router.post('/enable', requireBot(gateway), asyncHandler(controller.enableSentinel));
    router.post('/disable', requireBot(gateway), asyncHandler(controller.disableSentinel));
    router.get('/status', requireBot(gateway), asyncHandler(controller.getSentinelStatus));
    // Zone defense
    router.post('/zone', requireBot(gateway), asyncHandler(controller.setZoneDefense));
    router.get('/position', requireBot(gateway), asyncHandler(controller.getCurrentPosition));
    // Quick setup
    router.post('/quick-protect', requireBot(gateway), asyncHandler(controller.quickProtect));
    // Settings
    router.put('/settings', requireBot(gateway), asyncHandler(controller.updateSentinelSettings));
    return router;
}
