import { Router } from 'express';
import { createHealthRouter } from './controllers/health.js';
import { createBotRouter } from './controllers/bot.js';
import { createChatRouter } from './controllers/chat.js';
import { createMovementRouter } from './controllers/movement.js';
import { createMiningRouter } from './controllers/mining.js';
import { createCraftingRouter } from './controllers/crafting.js';
import { createInventoryRouter } from './controllers/inventory.js';
// Pathfinding and error handling controllers removed
import { createCombatRouter } from './controllers/combatRouter.js';
import { createSentinelRouter } from './controllers/sentinelRouter.js';
import { createDebugRouter } from './controllers/debugRouter.js';
export function buildRoutes(gateway) {
    const router = Router();
    // Basic routes
    router.use('/health', createHealthRouter(gateway));
    router.use('/bot', createBotRouter(gateway));
    router.use('/bot', createChatRouter(gateway));
    router.use('/bot', createMovementRouter(gateway));
    router.use('/bot', createMiningRouter(gateway));
    router.use('/bot', createCraftingRouter(gateway));
    router.use('/bot', createInventoryRouter(gateway));
    // Enhanced intelligence routes (removed)
    // Advanced system routes
    router.use('/combat', createCombatRouter(gateway));
    router.use('/sentinel', createSentinelRouter(gateway));
    // Debug routes
    router.use('/debug', createDebugRouter(gateway));
    return router;
}
