import { config } from './config.js';
import { BotGateway } from './bot/BotGateway.js';
import { createApp } from './http/app.js';
const gateway = new BotGateway(config.bot);
gateway.start();
const app = createApp(gateway);
const port = config.port;
app.listen(port, () => {
    console.log(`mcquest bridge ready on http://localhost:${port}`);
});
const shutdown = (signal) => {
    console.log(`received ${signal}, shutting down.`);
    process.exit(0);
};
// Handle uncaught exceptions to prevent crashes from chat format errors
process.on('uncaughtException', (error) => {
    if (error.message && error.message.includes('unknown chat format code')) {
        console.warn('[mcquest] Chat format error caught and suppressed:', error.message);
        return; // Don't crash, just log the error
    }
    console.error('[mcquest] Uncaught exception:', error);
    process.exit(1); // Still exit for other critical errors
});
// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('[mcquest] Unhandled promise rejection at:', promise, 'reason:', reason);
    console.error('[mcquest] Full error details:', JSON.stringify(reason, null, 2));
    if (reason && typeof reason === 'object' && 'stack' in reason) {
        console.error('[mcquest] Stack trace:', reason.stack);
    }
    // Don't exit for unhandled rejections, just log them
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
