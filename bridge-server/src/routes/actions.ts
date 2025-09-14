import { Router } from 'express';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import MinecraftBot from '../bot';

export function createActionsRoutes(bot: MinecraftBot): Router {
  const router = Router();

  router.post('/spawn', requireBot(bot), async (req, res) => {
    try {
      const { type, count = 1, near } = req.body || {};
      if (!type) return ResponseHelper.badRequest(res, 'type required');
      const c = Math.max(1, Math.min(10, parseInt(String(count), 10) || 1));
      let baseCmd = `/summon ${type}`;
      if (near?.playerName) {
        // Summon at player with offset radius if provided
        const radius = Math.max(0, Math.min(10, parseInt(String(near.radius || 0), 10) || 0));
        for (let i = 0; i < c; i++) {
          const cmd = radius > 0 ? `${baseCmd} ~${radius} ~ ~${radius}` : `${baseCmd} @p[name=${near.playerName}]`;
          await bot.runCommand(cmd, 1500);
        }
      } else {
        for (let i = 0; i < c; i++) await bot.runCommand(baseCmd, 1500);
      }
      ResponseHelper.success(res, { type, count: c });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Spawn failed');
    }
  });

  router.post('/grant', requireBot(bot), async (req, res) => {
    try {
      const { playerName, items } = req.body || {};
      if (!playerName) return ResponseHelper.badRequest(res, 'playerName required');
      const results = [] as any[];
      for (const it of (items || [])) {
        const { itemId, count, enchants } = it;
        const r = await bot.giveItem(playerName, itemId, Math.max(1, Math.min(64, count || 1)), enchants);
        results.push(r);
      }
      ResponseHelper.success(res, { results });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Grant failed');
    }
  });

  router.post('/effect', requireBot(bot), async (req, res) => {
    try {
      const { playerName, effectId, durationSec, amplifier = 0 } = req.body || {};
      if (!playerName || !effectId || !durationSec) return ResponseHelper.badRequest(res, 'playerName, effectId, durationSec required');
      const cmd = `/effect give ${playerName} ${effectId} ${Math.max(1, Math.min(3600, durationSec))} ${Math.max(0, Math.min(255, amplifier))}`;
      const out = await bot.runCommand(cmd, 1500);
      if (!out.ok) return ResponseHelper.error(res, 'Effect failed', 400);
      ResponseHelper.success(res, { command: cmd, output: out.output });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Effect failed');
    }
  });

  router.post('/waypoint', requireBot(bot), async (req, res) => {
    try {
      const { playerName, x, y, z, label } = req.body || {};
      if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') return ResponseHelper.badRequest(res, 'x,y,z numbers required');
      const text = label ? `${label} -> (${x}, ${y}, ${z})` : `Waypoint -> (${x}, ${y}, ${z})`;
      bot.say(text);
      ResponseHelper.success(res, { text });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Waypoint failed');
    }
  });

  return router;
}

export default createActionsRoutes;

