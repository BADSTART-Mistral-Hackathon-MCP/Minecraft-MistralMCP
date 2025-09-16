import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BotManager } from '../services/BotManager';
import { asyncHandler } from '../middleware/asyncHandler';

export function communicationRoutes(botManager: BotManager, io: SocketIOServer): Router {
    const router = Router();

    /**
     * @route POST /say
     * @desc Make bot say something in chat
     * @access Public
     */
    router.post('/say', asyncHandler(async (req: Request, res: Response) => {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        botManager.say(message);
        io.emit('bot_message_sent', { message, timestamp: Date.now() });

        res.json({
            success: true,
            message: 'Message sent to chat',
            content: message
        });
    }));

    /**
     * @route POST /whisper
     * @desc Send private message to a specific player
     * @access Public
     */
    router.post('/whisper', asyncHandler(async (req: Request, res: Response) => {
        const { username, message } = req.body;

        if (!username || !message) {
            return res.status(400).json({ error: 'Username and message are required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        botManager.whisper(username, message);
        io.emit('whisper_sent', { username, message, timestamp: Date.now() });

        res.json({
            success: true,
            message: `Whispered to ${username}`,
            recipient: username,
            content: message
        });
    }));

    /**
     * @route GET /chat/history
     * @desc Get recent chat history
     * @access Public
     */
    router.get('/chat/history', asyncHandler(async (req: Request, res: Response) => {
        const limit = parseInt(req.query.limit as string) || 50;
        const username = req.query.username as string;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const history = botManager.getChatHistory(limit, username);

        res.json({
            history,
            count: history.length,
            filtered: !!username
        });
    }));

    /**
     * @route POST /respond
     * @desc Make bot respond to a chat message with context
     * @access Public
     */
    router.post('/respond', asyncHandler(async (req: Request, res: Response) => {
        const { message, username, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const response = await botManager.generateResponse(message, username, context);
        botManager.say(response);

        io.emit('bot_response', {
            originalMessage: message,
            username,
            response,
            timestamp: Date.now()
        });

        res.json({
            success: true,
            message: 'Response sent',
            originalMessage: message,
            response
        });
    }));

    return router;
}