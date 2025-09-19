import type { Request, Response, NextFunction } from 'express';
import { respond } from '../response.js';

export function notFound(_req: Request, res: Response) {
  respond.notFound(res);
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('API error:', err);
  respond.error(res, err.message || 'Internal error');
}
