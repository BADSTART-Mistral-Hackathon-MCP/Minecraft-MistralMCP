import { Router } from 'express';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import MinecraftBot from '../bot';
import { getDM } from '../services/registry';
import { setPersona } from '../dm/personas';

export function createDMRoutes(bot: MinecraftBot): Router {
  const router = Router();

  router.post('/chat', requireBot(bot), async (req, res) => {
    try {
      const { playerName, message } = req.body || {};
      if (!playerName || !message) return ResponseHelper.badRequest(res, 'playerName and message required');
      const out = await getDM().onPlayerChat(playerName, message);
      if (out.dmText) {
        try { bot.say(out.dmText); } catch {}
      }
      ResponseHelper.success(res, out);
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'DM chat failed');
    }
  });

  router.post('/tool-calls', requireBot(bot), async (req, res) => {
    try {
      const { calls, questId } = req.body || {};
      // For now, we just echo back; mapping to endpoints can be added progressively
      ResponseHelper.success(res, { executed: calls?.length || 0, questId });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Tool-calls failed');
    }
  });

  router.post('/persona', (req, res) => {
    const { persona, temperature } = req.body || {};
    try {
      setPersona(persona, temperature);
      ResponseHelper.success(res, { persona, temperature }, 'Persona updated');
    } catch (e) {
      ResponseHelper.error(res, 'Invalid persona');
    }
  });

  router.get('/context', requireBot(bot), async (req, res) => {
    try {
      const ctx = await getDM().buildContext(String(req.query.playerName || ''));
      ResponseHelper.success(res, ctx);
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Context failed');
    }
  });

  return router;
}

export default createDMRoutes;

