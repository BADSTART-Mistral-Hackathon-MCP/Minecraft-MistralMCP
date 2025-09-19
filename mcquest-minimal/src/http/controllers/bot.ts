import { Router } from 'express';
import type { BotGateway } from '../../bot/BotGateway.js';
import { respond } from '../response.js';
import { requireBot } from '../middleware/requireBot.js';

export function createBotRouter(gateway: BotGateway) {
  const router = Router();

  router.get('/status', (_req, res) => {
    const data = gateway.snapshot();
    respond.ok(res, data);
  });

  router.get('/position', requireBot(gateway), (_req, res) => {
    try {
      const data = gateway.position();
      respond.ok(res, data);
    } catch (err) {
      respond.error(res, err instanceof Error ? err.message : 'Failed to read position');
    }
  });

  return router;
}
