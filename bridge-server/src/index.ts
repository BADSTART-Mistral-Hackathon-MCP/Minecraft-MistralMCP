import express, { Express } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { BotManager } from './services/BotManager';
import { WebSocketManager } from './services/WebSocketManager';
import { setupRoutes } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

class MinecraftBotAPI {
    private app: Express;
    private server: any;
    private io: SocketIOServer;
    private botManager: BotManager;
    private wsManager: WebSocketManager;

    constructor() {
        this.app = express();
        this.server = createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.botManager = new BotManager(this.io);
        this.wsManager = new WebSocketManager(this.io, this.botManager);

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }

    private setupMiddleware() {
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(requestLogger);
    }

    private setupRoutes() {
        setupRoutes(this.app, this.botManager, this.io);
        this.app.use(errorHandler);
    }

    private setupWebSocket() {
        this.wsManager.initialize();
    }

    async start(port: number = 3000) {
        this.server.listen(port, async () => {
            console.log(`Bot API server running on port ${port}`);
            try {
                await this.botManager.connectBot();
                console.log('Bot connection initiated');
            } catch (error) {
                console.error('Failed to connect bot:', error);
            }
        });
    }
}

// Start the server
const botAPI = new MinecraftBotAPI();
const port = parseInt(process.env.PORT || '3001');
botAPI.start(port);