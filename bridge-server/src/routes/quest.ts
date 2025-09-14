import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import PlanksQuestService from '../quest/PlanksQuestService';

// Singleton quest service per process
let service: PlanksQuestService | null = null;

export function createQuestRoutes(bot: MinecraftBot): Router {
  const router = Router();
  if (!service) service = new PlanksQuestService(bot);

  // Activate the quest (default target = 8 planks)
  router.post('/', requireBot(bot), (req, res) => {
    try {
      const { target = 8, assistCrafting = true, playerName } = req.body || {};
      if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
        return ResponseHelper.badRequest(res, 'playerName is required to reward the user on success');
      }
      const status = service!.start(target, assistCrafting, playerName.trim());
      ResponseHelper.success(res, status, 'Quest activated');
    } catch (error) {
      ResponseHelper.error(res, error instanceof Error ? error.message : 'Failed to start quest');
    }
  });

  // Quest status
  router.get('/status', (req, res) => {
    try {
      if (!service) return ResponseHelper.error(res, 'Quest service not available', 500);
      const status = service.status();
      ResponseHelper.success(res, status);
    } catch (error) {
      ResponseHelper.error(res, error instanceof Error ? error.message : 'Failed to get status');
      console.error(error);
    }
  });

  // Stop quest
  router.post('/stop', (req, res) => {
    try {
      if (!service) return ResponseHelper.error(res, 'Quest service not available', 500);
      const status = service.stop();
      ResponseHelper.success(res, status, 'Quest stopped');
    } catch (error) {
      ResponseHelper.error(res, error instanceof Error ? error.message : 'Failed to stop quest');
      console.log(error);
    }
  });

  return router;
}

export default createQuestRoutes;
