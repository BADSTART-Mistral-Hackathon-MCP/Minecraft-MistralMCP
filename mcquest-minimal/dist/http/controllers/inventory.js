import { Router } from 'express';
import { respond } from '../response.js';
import { requireBot } from '../middleware/requireBot.js';
export function createInventoryRouter(gateway) {
    const router = Router();
    router.get('/', requireBot(gateway), (_req, res) => {
        try {
            const items = gateway.inventory();
            respond.ok(res, { totalItems: items.length, items });
        }
        catch (err) {
            respond.error(res, err instanceof Error ? err.message : 'Failed to read inventory');
        }
    });
    router.post('/drop', requireBot(gateway), (req, res) => {
        const { itemName, count = 1 } = req.body ?? {};
        if (typeof itemName !== 'string' || itemName.trim().length === 0) {
            respond.badRequest(res, 'itemName must be provided');
            return;
        }
        try {
            const message = gateway.drop(itemName, Number(count) || 1);
            respond.ok(res, undefined, message);
        }
        catch (err) {
            respond.error(res, err instanceof Error ? err.message : 'Failed to drop item');
        }
    });
    return router;
}
