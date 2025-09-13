import { Express } from 'express';
import MinecraftBot from '../bot';
import { createHealthRoutes } from './health';
import { createBotRoutes } from './bot';
import { createMovementRoutes } from './movement';
import { createChatRoutes } from './chat';
import { createMiningRoutes } from './mining';
import { createCraftingRoutes } from './crafting';
import { createInventoryRoutes } from './inventory';

export function setupRoutes(app: Express, bot: MinecraftBot): void {
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
}