import { Request, Response, NextFunction } from 'express';
import { ResponseHelper } from '../utils/response';

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
    console.error('API Error:', err);
    ResponseHelper.error(res, 'Internal server error', 500);
}

export function notFoundHandler(req: Request, res: Response) {
    ResponseHelper.notFound(res, 'Endpoint not found');
}