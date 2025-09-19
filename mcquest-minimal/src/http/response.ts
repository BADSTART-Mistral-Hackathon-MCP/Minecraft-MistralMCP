import { Response } from 'express';

export type ApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
};

export const respond = {
  ok<T>(res: Response, data?: T, message?: string) {
    res.json({ success: true, message, data } satisfies ApiResponse<T>);
  },
  error(res: Response, message: string, status = 500) {
    res.status(status).json({ success: false, error: message } satisfies ApiResponse);
  },
  badRequest(res: Response, message: string) {
    respond.error(res, message, 400);
  },
  unavailable(res: Response, message = 'Bot unavailable') {
    respond.error(res, message, 503);
  },
  notFound(res: Response, message = 'Not found') {
    respond.error(res, message, 404);
  },
};
