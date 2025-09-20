import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { BotManager } from '../services/BotManager';
import { asyncHandler } from '../middleware/asyncHandler';
import { validateCraftingInput, validateMiningInput } from '../middleware/validation';

export function actionRoutes(botManager: BotManager, io: SocketIOServer): Router {
    const router = Router();

    /**
     * @route POST /craft
     * @desc Craft items if possible
     * @access Public
     */
    router.post('/craft', validateCraftingInput, asyncHandler(async (req: Request, res: Response) => {
        const { item, quantity = 1 } = req.body; // removed requiresTable

        if (!botManager.isConnected()) {
            return res.status(400).json({
                success: false,
                error: 'Bot not connected'
            });
        }

        try {
            const result = await botManager.craftItem(item, quantity);

            if (result.success || result.crafted) {
                io.emit('crafting_completed', { item, quantity, result });
                return res.json({
                    success: true,
                    message: `Successfully crafted ${quantity} ${item}`,
                    item,
                    quantity,
                    data: result
                });
            } else {
                return res.json({
                    success: false,
                    error: result.error || `Failed to craft ${item}`,
                    item,
                    quantity,
                    data: result
                });
            }
        } catch (error: any) {
            return res.json({
                success: false,
                error: error.message || 'Crafting failed',
                item,
                quantity
            });
        }
    }));

    /**
     * @route POST /mine
     * @desc Mine specific types of blocks
     * @access Public
     */
    router.post('/mine', validateMiningInput, asyncHandler(async (req: Request, res: Response) => {
        const { blockType, count = 1 } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.mineBlocks(blockType, count);
        io.emit('mining_completed', { blockType, count, result });

        res.json({
            success: true,
            message: `Mined ${result.mined} ${blockType} blocks`,
            blockType,
            requested: count,
            mined: result.mined,
            details: result
        });
    }));

    /**
     * @route POST /collect
     * @desc Collect dropped items nearby
     * @access Public
     */
    router.post('/collect', asyncHandler(async (req: Request, res: Response) => {
        const { itemType, radius = 16 } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const collected = await botManager.collectItems(itemType, radius);
        io.emit('items_collected', { itemType, radius, collected });

        res.json({
            success: true,
            message: `Collected ${collected.length} items`,
            itemType: itemType || 'any',
            collected
        });
    }));

    /**
 * @route POST /place
 * @desc Place blocks at specific location
 * @access Public
 */
    router.post('/place', asyncHandler(async (req: Request, res: Response) => {
        const { blockType, count = 1, x, y, z, face = 'top' } = req.body;
        if (!blockType) {
            return res.status(400).json({ success: false, error: 'blockType is required' });
        }
        if (!botManager.isConnected()) {
            return res.status(400).json({ success: false, error: 'Bot not connected' });
        }

        // If count > 1, place multiple blocks (you might want to implement this)
        // For now, just place one block
        const result = await botManager.placeBlock(blockType, x, y, z, face);
        io.emit('block_placed', { blockType, result });
        res.json(result);
    }));
    /**
     * @route POST /use
     * @desc Use/right-click on a block or with an item
     * @access Public
     */
    router.post('/use', asyncHandler(async (req: Request, res: Response) => {
        const { x, y, z, item, face = 'top' } = req.body;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.useItem(x, y, z, item, face);
        io.emit('item_used', { x, y, z, item, face, result });

        res.json({
            success: true,
            message: item ? `Used ${item}` : `Used item at ${x}, ${y}, ${z}`,
            item,
            position: x !== undefined ? { x, y, z } : null,
            details: result
        });
    }));

    /**
     * @route POST /equip
     * @desc Equip item from inventory
     * @access Public
     */
    router.post('/equip', asyncHandler(async (req: Request, res: Response) => {
        const { item, slot = 'hand' } = req.body;

        if (!item) {
            return res.status(400).json({ error: 'Item is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.equipItem(item, slot);
        io.emit('item_equipped', { item, slot, result });

        res.json({
            success: true,
            message: `Equipped ${item} to ${slot}`,
            item,
            slot,
            details: result
        });
    }));

    /**
     * @route POST /drop
     * @desc Drop items from inventory
     * @access Public
     */
    router.post('/drop', asyncHandler(async (req: Request, res: Response) => {
        const { item, quantity = 1 } = req.body;

        if (!item) {
            return res.status(400).json({ error: 'Item is required' });
        }

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const result = await botManager.dropItem(item, quantity);
        io.emit('item_dropped', { item, quantity, result });

        res.json({
            success: true,
            message: `Dropped ${quantity} ${item}`,
            item,
            quantity,
            details: result
        });
    }));

    /**
     * @route GET /recipes
     * @desc Get available recipes for an item
     * @access Public
     */
    router.get('/recipes', asyncHandler(async (req: Request, res: Response) => {
        const { item } = req.query;

        if (!botManager.isConnected()) {
            return res.status(400).json({ error: 'Bot not connected' });
        }

        const recipes = botManager.getRecipes(item as string);

        res.json({
            item: item || 'all',
            recipes,
            count: recipes.length
        });
    }));

    return router;
}