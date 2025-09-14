import { Router } from 'express';
import MinecraftBot from '../bot';
import { ResponseHelper } from '../utils/response';
import { requireBot } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { CraftRequest } from '../types';

export function createCraftingRoutes(bot: MinecraftBot): Router {
    const router = Router();

    router.post('/item', requireBot(bot), asyncHandler(async (req, res) => {
        const { item, count = 1 }: CraftRequest = req.body;

        if (typeof item !== 'string' || !item.trim()) {
            return ResponseHelper.badRequest(res, 'Item must be a non-empty string');
        }

        try {
            const result = await bot.craft(item, count);
            ResponseHelper.success(res, undefined, result);
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Crafting failed');
        }
    }));

    // Give items via server command with optional enchantments (requires OP)
    // Example: GET /crafting/give?player=Alex&item=diamond_sword&count=1&enchant=sharpness:5&enchant=unbreaking:3
    router.get('/give', requireBot(bot), asyncHandler(async (req, res) => {
        const player = (req.query.player as string || '').trim();
        const item = (req.query.item as string || '').trim();
        const countRaw = (req.query.count as string || '1').trim();
        const encRaw = req.query.enchant;

        if (!player) return ResponseHelper.badRequest(res, 'Missing player query param');
        if (!item) return ResponseHelper.badRequest(res, 'Missing item query param');

        const count = Math.max(1, Math.min(64, parseInt(countRaw, 10)));
        if (isNaN(count)) return ResponseHelper.badRequest(res, 'Invalid count');

        let enchants: Array<{ id: string; level: number }> | undefined;
        if (encRaw) {
            const list = Array.isArray(encRaw) ? encRaw : [encRaw];
            enchants = list.map((e: any) => String(e)).map((pair: string) => {
                // Accept forms: "sharpness:5" or "minecraft:sharpness:5"
                const parts = pair.split(':');
                if (parts.length < 2) return { id: pair, level: 1 };
                const lvl = parseInt(parts.pop() as string, 10);
                const id = parts.join(':');
                return { id, level: isNaN(lvl) ? 1 : lvl };
            }).filter(e => e.id && e.level > 0);
        }

        try {
            const { ok, command, output } = await bot.giveItem(player, item, count, enchants);
            if (!ok) {
                return ResponseHelper.error(res, `Give failed. Ensure bot is OP and player is online. Command: ${command}. Output: ${output.join(' | ')}`, 400);
            }
            ResponseHelper.success(res, { player, item, count, enchants, command, output }, 'Item(s) given');
        } catch (error) {
            ResponseHelper.error(res, error instanceof Error ? error.message : 'Give failed');
        }
    }));

    // Future crafting endpoints:
    // router.get('/recipes', ...)
    // router.post('/recipe', ...)
    // router.get('/materials', ...)

    return router;
}
