import express from 'express';
import cors from 'cors';
import { buildRoutes } from './routes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';
export function createApp(gateway) {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/', buildRoutes(gateway));
    app.use('*', notFound);
    app.use(errorHandler);
    return app;
}
