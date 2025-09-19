import { Router } from 'express';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createPathfindingController } from './pathfinding.js';
export function createPathfindingRouter(gateway) {
    const router = Router();
    const controller = createPathfindingController(gateway);
    // Enhanced pathfinding methods
    router.post('/enhanced-path', requireBot(gateway), asyncHandler(controller.findEnhancedPath));
    router.post('/safe-path', requireBot(gateway), asyncHandler(controller.findSafePath));
    router.post('/fast-path', requireBot(gateway), asyncHandler(controller.findFastPath));
    router.post('/alternative-paths', requireBot(gateway), asyncHandler(controller.findAlternativePaths));
    // Specialized pathfinding
    router.post('/path-to-block', requireBot(gateway), asyncHandler(controller.findPathToNearestBlock));
    router.post('/path-to-player', requireBot(gateway), asyncHandler(controller.findPathToPlayer));
    router.post('/path-to-safety', requireBot(gateway), asyncHandler(controller.findPathToSafeLocation));
    // Enhanced movement
    router.post('/move-enhanced', requireBot(gateway), asyncHandler(controller.moveToEnhanced));
    return router;
}
