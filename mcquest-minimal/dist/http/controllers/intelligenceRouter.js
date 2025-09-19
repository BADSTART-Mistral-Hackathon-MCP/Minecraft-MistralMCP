import { Router } from 'express';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createIntelligenceController } from './intelligence.js';
export function createIntelligenceRouter(gateway) {
    const router = Router();
    const controller = createIntelligenceController(gateway);
    // Environment analysis
    router.get('/analyze-environment', requireBot(gateway), asyncHandler(controller.analyzeEnvironment));
    // Decision making
    router.post('/make-decision', requireBot(gateway), asyncHandler(controller.makeDecision));
    // Action execution
    router.post('/execute-action', requireBot(gateway), asyncHandler(controller.executeAction));
    // Auto mode
    router.post('/auto-mode', requireBot(gateway), asyncHandler(controller.enableAutoMode));
    // Goal management
    router.post('/goals', requireBot(gateway), asyncHandler(controller.addGoal));
    router.delete('/goals', requireBot(gateway), asyncHandler(controller.removeGoal));
    router.get('/goals', requireBot(gateway), asyncHandler(controller.getGoals));
    // Memory management
    router.post('/memory', requireBot(gateway), asyncHandler(controller.remember));
    router.get('/memory/:key', requireBot(gateway), asyncHandler(controller.recall));
    return router;
}
