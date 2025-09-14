import { Router } from 'express';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import MinecraftBot from '../bot';

export function createWorldRoutes(bot: MinecraftBot): Router {
  const router = Router();

  router.get('/snapshot', requireBot(bot), async (req, res) => {
    try {
      const around = String(req.query.around || '');
      const radius = Math.max(1, Math.min(64, parseInt(String(req.query.radius || '32'), 10) || 32));
      const internal = bot.getInternalBot?.();
      const status = bot.getStatus();
      const pos = bot.getPosition();
      const players = internal ? Object.values(internal.players).filter(p => p && p.username).map(p => p!.username) : [];
      // Very light snapshot
      ResponseHelper.success(res, {
        time: Date.now(),
        health: status.health,
        food: status.food,
        pos,
        playersNearby: players,
        around,
        radius
      });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Snapshot failed');
    }
  });

  return router;
}

export default createWorldRoutes;

