import type { Request, Response, NextFunction } from 'express';
import type { BotGateway } from '../../bot/BotGateway.js';
import { respond } from '../response.js';

export const requireBot = (gateway: BotGateway) => (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!gateway.isReady()) {
    respond.unavailable(res);
    return;
  }
  next();
};
