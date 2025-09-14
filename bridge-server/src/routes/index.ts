import { Express } from 'express';
import MinecraftBot from '../bot';
import { createHealthRoutes } from './health';
import { createBotRoutes } from './bot';
import { createMovementRoutes } from './movement';
import { createChatRoutes } from './chat';
import { createMiningRoutes } from './mining';
import { createCraftingRoutes } from './crafting';
import { createInventoryRoutes } from './inventory';
import { createQuestRoutes } from './quest';
import { createDMRoutes } from './dm';
import { createQuestsRoutes } from './quests';
import { createWorldRoutes } from './world';
import { createActionsRoutes } from './actions';
import { createEventsRoutes } from './events';
import { initServices } from '../services/registry';

export function setupRoutes(app: Express, bot: MinecraftBot): void {
    // Initialize shared services for DM/Quests
    initServices(bot);
    // Health routes
    app.use('/health', createHealthRoutes(bot));

    // Bot status routes
    app.use('/bot', createBotRoutes(bot));

    // Feature-specific routes with proper namespacing
    app.use('/movement', createMovementRoutes(bot));
    app.use('/chat', createChatRoutes(bot));
    app.use('/mining', createMiningRoutes(bot));
    app.use('/crafting', createCraftingRoutes(bot));
    app.use('/inventory', createInventoryRoutes(bot));
    app.use('/quest', createQuestRoutes(bot));
    // New namespaced routes for DM/Quests/World/Actions and server-sent events
    app.use('/dm', createDMRoutes(bot));
    app.use('/quests', createQuestsRoutes(bot));
    app.use('/world', createWorldRoutes(bot));
    app.use('/actions', createActionsRoutes(bot));
    app.use('/', createEventsRoutes());
}
