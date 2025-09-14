import { Router } from 'express';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import MinecraftBot from '../bot';
import { getDM, getQuestEngine } from '../services/registry';
import { setPersona } from '../dm/personas';
import { validateToolCalls, ToolCall } from '../dm/tools';

export function createDMRoutes(bot: MinecraftBot): Router {
  const router = Router();

  router.post('/chat', requireBot(bot), async (req, res) => {
    try {
      const { playerName, message } = req.body || {};
      if (!playerName || !message) return ResponseHelper.badRequest(res, 'playerName and message required');
      const out = await getDM().onPlayerChat(playerName, message);
      ResponseHelper.success(res, out);
    } catch (e) {
      ResponseHelper.error(res, e instanceof Error ? e.message : 'DM chat failed');
    }
  });

  router.post('/tool-calls', requireBot(bot), async (req, res) => {
    try {
      const { calls, questId } = req.body || {} as { calls: ToolCall[]; questId?: string };
      if (!Array.isArray(calls) || calls.length === 0) return ResponseHelper.badRequest(res, 'calls[] required');
      const v = validateToolCalls(calls);
      if (!v.ok) return ResponseHelper.badRequest(res, v.error || 'invalid calls');

      const engine = getQuestEngine();
      const results: Array<{ tool: string; ok: boolean; result?: any; error?: string }> = [];

      for (const c of calls) {
        try {
          switch (c.tool) {
            case 'propose_quest': {
              const playerName = c.args.playerName;
              if (!playerName) throw new Error('playerName required');
              // Simple blueprint: Collect 8 oak planks
              const bp = {
                title: 'Collecte de ressources',
                synopsis: 'Aide le village en rassemblant des planches.',
                seed: `${playerName}-${Date.now()}`,
                objectives: [ { id:'o1', type:'COLLECT', params:{ item:'minecraft:oak_planks', count:8 }, target: 8 } ],
                failureConditions: [ { id:'f1', type:'TIMER', params:{ seconds:900 } } ],
                reward: { items: [ { itemId:'minecraft:emerald', count:10 } ] },
                noveltySignature: `basic_collect_oak_planks`
              };
              const q = await engine.instantiate(bp as any, playerName);
              results.push({ tool: c.tool, ok: true, result: { quest: q, dmText: 'Accepter cette quête ? (oui/non)' } });
              break;
            }
            case 'start_quest': {
              const id = c.args.questId || questId; if (!id) throw new Error('questId required');
              await engine.start(id);
              results.push({ tool: c.tool, ok: true, result: { id } });
              break;
            }
            case 'branch_quest': {
              const id = c.args.questId || questId; if (!id) throw new Error('questId required');
              const choice = String(c.args.choice || '');
              await engine.branch(id, choice);
              results.push({ tool: c.tool, ok: true, result: { id, choice } });
              break;
            }
            case 'set_timer': {
              const id = c.args.questId || questId; if (!id) throw new Error('questId required');
              const seconds = Number(c.args.seconds || 0);
              const label = c.args.label;
              await engine.setTimer(id, seconds, label);
              results.push({ tool: c.tool, ok: true, result: { id, seconds, label } });
              break;
            }
            case 'grant_reward': {
              const { playerName, items } = c.args;
              if (!playerName) throw new Error('playerName required');
              const outputs = [] as any[];
              for (const it of (items || [])) {
                const r = await bot.giveItem(playerName, it.itemId, Math.max(1, Math.min(64, it.count || 1)), it.enchants);
                outputs.push(r);
              }
              results.push({ tool: c.tool, ok: true, result: { outputs } });
              break;
            }
            case 'spawn_encounter': {
              const mob = c.args.mob; const near = c.args.near || {}; const count = Math.max(1, Math.min(10, Number(c.args.count || 1)));
              if (!mob || !near.playerName) throw new Error('mob and near.playerName required');
              let spawned = 0;
              for (let i = 0; i < count; i++) {
                const out = await bot.runCommand(`/summon ${mob} @p[name=${near.playerName}]`, 1500);
                if (out.ok) spawned++;
              }
              results.push({ tool: c.tool, ok: true, result: { spawned } });
              break;
            }
            case 'apply_effect': {
              const { playerName, effectId, durationSec, amplifier = 0 } = c.args;
              const out = await bot.runCommand(`/effect give ${playerName} ${effectId} ${Math.max(1, Math.min(3600, durationSec))} ${Math.max(0, Math.min(255, amplifier))}`, 1500);
              results.push({ tool: c.tool, ok: out.ok, result: { output: out.output } });
              break;
            }
            case 'dm_say': {
              const text = String(c.args?.text || '');
              if (text) { try { bot.say(text); } catch {} }
              results.push({ tool: c.tool, ok: true });
              break;
            }
            default:
              results.push({ tool: c.tool, ok: false, error: 'unsupported' });
          }
        } catch (err) {
          results.push({ tool: c.tool, ok: false, error: err instanceof Error ? err.message : 'error' });
        }
      }

      ResponseHelper.success(res, { results, questId });
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

