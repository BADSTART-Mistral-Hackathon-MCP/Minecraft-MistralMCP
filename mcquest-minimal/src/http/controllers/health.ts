import { Router } from 'express';
import type { BotGateway } from '../../bot/BotGateway.js';
import { respond } from '../response.js';

export function createHealthRouter(gateway: BotGateway) {
  const router = Router();

  router.get('/', (_req, res) => {
    respond.ok(res, {
      server: 'online',
      bot: gateway.isReady() ? 'connected' : 'disconnected',
    }, 'mcquest bridge operational');
  });

  return router;
}
