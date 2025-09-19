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

const shutdown = (signal: NodeJS.Signals) => {
  console.log(`received ${signal}, shutting down.`);
  process.exit(0);
};

// Evite un crash si le serveur envoie un code de couleur inconnu dans le chat
process.on('uncaughtException', (error: any) => {
  if (error?.message?.includes('unknown chat format code')) {
    console.warn('[mcquest] Chat format error caught and suppressed:', error.message);
    return;
  }
  console.error('[mcquest] Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise) => {
  console.error('[mcquest] Unhandled promise rejection at:', promise, 'reason:', reason);
  if (reason && typeof reason === 'object' && 'stack' in reason) {
    console.error('[mcquest] Stack trace:', (reason as any).stack);
  }
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
