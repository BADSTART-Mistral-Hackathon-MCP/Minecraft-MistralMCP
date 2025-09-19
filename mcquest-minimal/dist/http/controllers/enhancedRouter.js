import { Router } from 'express';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createEnhancedController } from './enhanced.js';
export function createEnhancedRouter(gateway) {
    const router = Router();
    const controller = createEnhancedController(gateway);
    // Enhanced actions
    router.post('/mine', requireBot(gateway), asyncHandler(controller.mineEnhanced));
    router.post('/craft', requireBot(gateway), asyncHandler(controller.craftEnhanced));
    // System information and diagnostics
    router.get('/status', requireBot(gateway), asyncHandler(controller.getEnhancedStatus));
    router.get('/system-check', requireBot(gateway), asyncHandler(controller.systemCheck));
    router.get('/capabilities', requireBot(gateway), asyncHandler(controller.getCapabilities));
    return router;
}
