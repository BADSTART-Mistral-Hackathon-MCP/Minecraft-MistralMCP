import { Router } from 'express';
import type { BotGateway } from '../../bot/BotGateway.js';
import { respond } from '../response.js';
import { requireBot } from '../middleware/requireBot.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export function createMovementRouter(gateway: BotGateway) {
  const router = Router();

  router.post('/move', requireBot(gateway), asyncHandler(async (req, res) => {
    const { x, y, z } = req.body ?? {};
    if (![x, y, z].every((v) => typeof v === 'number')) {
      respond.badRequest(res, 'x, y, z must be numbers');
      return;
    }

    const message = await gateway.moveTo(x, y, z);
    respond.ok(res, undefined, message);
  }));

  router.post('/follow', requireBot(gateway), (req, res) => {
    const { playerName, distance = 3, continuous = false } = req.body ?? {};
    if (playerName !== undefined && typeof playerName !== 'string') {
      respond.badRequest(res, 'playerName must be a string when provided');
      return;
    }

    try {
      const message = gateway.follow(playerName, Number(distance) || 3, Boolean(continuous));
      respond.ok(res, undefined, message);
    } catch (err) {
      respond.error(res, err instanceof Error ? err.message : 'Failed to follow player');
    }
  });

  router.post('/stop', requireBot(gateway), (_req, res) => {
    try {
      const message = gateway.stop();
      respond.ok(res, undefined, message);
    } catch (err) {
      respond.error(res, err instanceof Error ? err.message : 'Failed to stop bot');
    }
  });

  router.post('/look', requireBot(gateway), (req, res) => {
    const { playerName } = req.body ?? {};
    if (typeof playerName !== 'string' || playerName.trim().length === 0) {
      respond.badRequest(res, 'playerName is required');
      return;
    }

    try {
      const message = gateway.lookAtPlayer(playerName);
      respond.ok(res, undefined, message);
    } catch (err) {
      respond.error(res, err instanceof Error ? err.message : 'Failed to look at player');
    }
  });

  return router;
}
