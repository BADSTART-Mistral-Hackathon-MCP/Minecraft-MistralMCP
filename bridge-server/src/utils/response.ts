import { Response } from 'express';
import { ApiResponse } from '../types';

export class ResponseHelper {
    static success<T>(res: Response, data?: T, message?: string): void {
        res.json({
            success: true,
            message,
            data
        } as ApiResponse<T>);
    }

    static error(res: Response, error: string, status = 500): void {
        res.status(status).json({
            success: false,
            error
        } as ApiResponse);
    }

    static badRequest(res: Response, error: string): void {
        ResponseHelper.error(res, error, 400);
    }

    static notFound(res: Response, error = 'Resource not found'): void {
        ResponseHelper.error(res, error, 404);
    }

    static serviceUnavailable(res: Response, error = 'Service unavailable'): void {
        ResponseHelper.error(res, error, 503);
    }
}