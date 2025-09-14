import { Router } from 'express';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import MinecraftBot from '../bot';
import { getQuestEngine } from '../services/registry';
import { QuestBlueprint } from '../types/quest';
import crypto from 'crypto';

export function createQuestsRoutes(bot: MinecraftBot): Router {
  const router = Router();
  const engine = getQuestEngine();

  router.post('/generate', requireBot(bot), async (req, res) => {
    try {
      const { playerName, seed, biomeBias, difficulty } = req.body || {};
      if (!playerName) return ResponseHelper.badRequest(res, 'playerName required');

      const bp: QuestBlueprint = {
        title: 'Collecte de ressources',
        synopsis: "Rassemble des planches pour aider le village.",
        seed: seed || `${playerName}-${Date.now()}`,
        biomeBias: biomeBias || ['plains','forest'],
        objectives: [
          { id: 'o1', type:'COLLECT', params: { item: 'minecraft:oak_planks', count: 8 }, target: 8 }
        ],
        failureConditions: [ { id: 'f1', type: 'TIMER', params: { seconds: 900 } } ],
        reward: { items: [ { itemId: 'minecraft:emerald', count: 10 } ] },
        flavorLines: { start: 'Le village a besoin de bois...', success: ['Ta contribution est précieuse.'] },
        noveltySignature: crypto.createHash('sha1').update(`COLLECT:oak_planks:${difficulty||'normal'}:${biomeBias?.join(',')}`).digest('hex')
      };

      const q = await engine.instantiate(bp, playerName);
      ResponseHelper.success(res, { quest: q, dmText: 'Accepter cette quête ? (oui/non)' });
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Generate failed');
    }
  });

  router.post('/:id/start', requireBot(bot), async (req, res) => {
    try {
      await engine.start(req.params.id);
      ResponseHelper.success(res, { id: req.params.id }, 'Quest started');
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Start failed');
    }
  });

  router.post('/:id/accept', requireBot(bot), async (req, res) => {
    try { await engine.accept(req.params.id); ResponseHelper.success(res, { id: req.params.id }, 'Quest accepted'); }
    catch (e) { ResponseHelper.error(res, e instanceof Error ? e.message : 'Accept failed'); }
  });

  router.post('/:id/decline', requireBot(bot), async (req, res) => {
    try { await engine.decline(req.params.id); ResponseHelper.success(res, { id: req.params.id }, 'Quest declined'); }
    catch (e) { ResponseHelper.error(res, e instanceof Error ? e.message : 'Decline failed'); }
  });

  router.get('/:id/status', async (req, res) => {
    try {
      const q = engine.get(req.params.id);
      if (!q) return ResponseHelper.notFound(res, 'Quest not found');
      ResponseHelper.success(res, q);
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'Status failed');
    }
  });

  router.post('/:id/branch', requireBot(bot), async (req, res) => {
    try { await engine.branch(req.params.id, String(req.body?.choice || '')); ResponseHelper.success(res, { id: req.params.id }); }
    catch (e) { ResponseHelper.error(res, e instanceof Error ? e.message : 'Branch failed'); }
  });

  router.post('/:id/stop', requireBot(bot), async (req, res) => {
    try { await engine.fail(req.params.id, 'stopped'); ResponseHelper.success(res, { id: req.params.id }, 'Quest stopped'); }
    catch (e) { ResponseHelper.error(res, e instanceof Error ? e.message : 'Stop failed'); }
  });

  router.post('/:id/reward', requireBot(bot), async (req, res) => {
    try { await engine.succeed(req.params.id); ResponseHelper.success(res, { id: req.params.id }, 'Reward granted'); }
    catch (e) { ResponseHelper.error(res, e instanceof Error ? e.message : 'Reward failed'); }
  });

  return router;
}

export default createQuestsRoutes;

