import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import MinecraftBot from './bot';
import { setupRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middleware/error';
import { BotConfig } from './types';

// Load environment variables
dotenv.config();

// Bot configuration
const botConfig: BotConfig = {
    host: process.env.MC_HOST || 'localhost',
    port: parseInt(process.env.MC_PORT || '25565'),
    username: process.env.MC_USERNAME || 'BridgeBot',
    password: process.env.MC_PASSWORD,
    version: process.env.MC_VERSION || '1.21.1'
};

// Server configuration
const serverPort = parseInt(process.env.PORT || '3001');

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create bot instance
console.log('🚀 Starting Minecraft Bot Bridge Server...');
console.log(`📝 Bot config: ${botConfig.host}:${botConfig.port} as ${botConfig.username}`);

const bot = new MinecraftBot(botConfig);

// Setup routes
setupRoutes(app, bot);

// Error handling middleware (must be last)
app.use('*', notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(serverPort, () => {
    console.log(`🌐 Bridge server running on http://localhost:${serverPort}`);
    console.log(`🩺 Health check: http://localhost:${serverPort}/health`);
    console.log('📋 Available endpoints:');
    console.log('  GET  /health             - Server and bot status');
    console.log('  GET  /bot/status         - Detailed bot information');
    console.log('  POST /movement/moveTo    - Move bot to coordinates');
    console.log('  POST /chat/say           - Make bot speak');
    console.log('  POST /mining/block       - Mine specific blocks');
    console.log('  POST /crafting/item      - Craft items');
    console.log('  GET  /inventory          - Get bot inventory');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    process.exit(0);
});