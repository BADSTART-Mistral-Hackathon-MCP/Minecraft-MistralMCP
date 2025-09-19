import { Router } from 'express';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createSurvivalController } from './survival.js';
export function createSurvivalRouter(gateway) {
    const router = Router();
    const controller = createSurvivalController(gateway);
    // Survival mode control
    router.post('/start', requireBot(gateway), asyncHandler(controller.startSurvival));
    router.post('/stop', requireBot(gateway), asyncHandler(controller.stopSurvival));
    router.get('/status', requireBot(gateway), asyncHandler(controller.getSurvivalState));
    // Smart mining
    router.post('/smart-mining', requireBot(gateway), asyncHandler(controller.smartMining));
    router.post('/mining-plan', requireBot(gateway), asyncHandler(controller.executeMiningPlan));
    return router;
}
