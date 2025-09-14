import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import SimpleGoldQuestService from '../quest/SimpleGoldQuestService';

// Singleton simple quest service per process
let service: SimpleGoldQuestService | null = null;

export function createQuestRoutes(bot: MinecraftBot): Router {
  const router = Router();
  if (!service) service = new SimpleGoldQuestService(bot);

  // Single endpoint to start the simple gold-ingot quest
  router.post('/', requireBot(bot), (req, res) => {
    try {
      const status = service!.start();
      ResponseHelper.success(res, status, 'Simple gold quest started');
    } catch (error) {
      ResponseHelper.error(res, error instanceof Error ? error.message : 'Failed to start quest');
    }
  });

  return router;
}

export default createQuestRoutes;
