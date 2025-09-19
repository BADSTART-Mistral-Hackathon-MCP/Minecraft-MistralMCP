import { Router } from 'express';
import type { BotGateway } from '../../bot/BotGateway.js';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { createCombatController } from './combat.js';

export function createCombatRouter(gateway: BotGateway) {
  const router = Router();
  const controller = createCombatController(gateway);

  // Combat mode control
  router.post('/enable', requireBot(gateway), asyncHandler(controller.enableCombat));
  router.post('/disable', requireBot(gateway), asyncHandler(controller.disableCombat));
  router.get('/status', requireBot(gateway), asyncHandler(controller.getCombatStatus));

  // Combat modes
  router.post('/aggressive', requireBot(gateway), asyncHandler(controller.enableAggressiveMode));
  router.post('/retaliation', requireBot(gateway), asyncHandler(controller.enableRetaliationMode));

  // Actions
  router.post('/attack', requireBot(gateway), asyncHandler(controller.attackPlayer));

  // Settings
  router.put('/settings', requireBot(gateway), asyncHandler(controller.updateCombatSettings));
  router.delete('/attackers', requireBot(gateway), asyncHandler(controller.clearAttackers));

  return router;
}