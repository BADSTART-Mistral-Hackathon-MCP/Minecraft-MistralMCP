import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BotManager } from '../services/BotManager';
import { healthRoutes } from './health';
import { statusRoutes } from './status';
import { movementRoutes } from './movement';
import { communicationRoutes } from './communication';
import { actionRoutes } from './actions';
import { combatRoutes } from './combat';

export function setupRoutes(app: Express, botManager: BotManager, io: SocketIOServer) {
    // API version prefix
    const apiPrefix = '/api/v1';

    // Health and system routes (no prefix for health checks)
    app.use('/', healthRoutes(botManager));

    // Main API routes
    app.use(`${apiPrefix}/status`, statusRoutes(botManager, io));
    app.use(`${apiPrefix}/movement`, movementRoutes(botManager, io));
    app.use(`${apiPrefix}/communication`, communicationRoutes(botManager, io));
    app.use(`${apiPrefix}/actions`, actionRoutes(botManager, io));
    app.use(`${apiPrefix}/combat`, combatRoutes(botManager, io));

    // Legacy routes (for backward compatibility)
    app.use('/', statusRoutes(botManager, io));
    app.use('/', movementRoutes(botManager, io));
    app.use('/', communicationRoutes(botManager, io));
    app.use('/', actionRoutes(botManager, io));
    app.use('/', combatRoutes(botManager, io));
}