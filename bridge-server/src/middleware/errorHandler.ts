import { Request, Response, NextFunction } from 'express';

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
    console.error('Error occurred:', error);

    // Bot connection errors
    if (error.message.includes('Bot not connected')) {
        return res.status(503).json({
            success: false,
            message: 'Bot is not connected to Minecraft server',
            error: 'SERVICE_UNAVAILABLE'
        });
    }

    // Pathfinding errors
    if (error.message.includes('pathfinder') || error.message.includes('No path')) {
        return res.status(400).json({
            success: false,
            message: 'Cannot reach destination',
            error: 'PATHFINDING_ERROR'
        });
    }

    // Minecraft API errors
    if (error.message.includes('not found')) {
        return res.status(404).json({
            success: false,
            message: error.message,
            error: 'NOT_FOUND'
        });
    }

    // Default error response
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
        error: 'INTERNAL_ERROR'
    });
}