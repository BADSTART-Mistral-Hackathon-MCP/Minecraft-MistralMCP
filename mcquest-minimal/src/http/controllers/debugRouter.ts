import { Router } from 'express';
import type { BotGateway } from '../../bot/BotGateway.js';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createDebugController } from './debug.js';

export function createDebugRouter(gateway: BotGateway) {
  const router = Router();
  const controller = createDebugController(gateway);

  // Debug endpoints
  router.get('/players', requireBot(gateway), asyncHandler(controller.getPlayers));
  router.get('/entities', requireBot(gateway), asyncHandler(controller.getEntities));
  router.post('/refresh', requireBot(gateway), asyncHandler(controller.refreshPlayers));

  return router;
}