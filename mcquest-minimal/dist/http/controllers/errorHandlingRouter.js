import { Router } from 'express';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createErrorHandlingController } from './errorHandling.js';
export function createErrorHandlingRouter(gateway) {
    const router = Router();
    const controller = createErrorHandlingController(gateway);
    // Error history and statistics
    router.get('/history', requireBot(gateway), asyncHandler(controller.getErrorHistory));
    router.get('/recent', requireBot(gateway), asyncHandler(controller.getRecentErrors));
    router.get('/stats', requireBot(gateway), asyncHandler(controller.getErrorStats));
    // Error management
    router.delete('/history', requireBot(gateway), asyncHandler(controller.clearErrorHistory));
    // Testing and capabilities
    router.post('/test', requireBot(gateway), asyncHandler(controller.testErrorHandling));
    router.get('/capabilities', requireBot(gateway), asyncHandler(controller.getCapabilities));
    return router;
}
