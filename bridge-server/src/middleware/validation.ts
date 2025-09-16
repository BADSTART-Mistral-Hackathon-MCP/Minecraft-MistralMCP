import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../types';

export function validateMovementInput(req: Request, res: Response, next: NextFunction) {
    const { x, y, z } = req.body;
    const errors: ValidationError[] = [];

    if (typeof x !== 'number') {
        errors.push({ field: 'x', message: 'X coordinate must be a number', value: x });
    }
    if (typeof y !== 'number') {
        errors.push({ field: 'y', message: 'Y coordinate must be a number', value: y });
    }
    if (typeof z !== 'number') {
        errors.push({ field: 'z', message: 'Z coordinate must be a number', value: z });
    }

    // Reasonable coordinate limits
    if (Math.abs(x) > 30000000) errors.push({ field: 'x', message: 'X coordinate out of bounds' });
    if (Math.abs(z) > 30000000) errors.push({ field: 'z', message: 'Z coordinate out of bounds' });
    if (y < -64 || y > 320) errors.push({ field: 'y', message: 'Y coordinate out of bounds' });

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid movement coordinates',
            errors
        });
    }

    next();
}

export function validateCraftingInput(req: Request, res: Response, next: NextFunction) {
    const { item, quantity } = req.body;
    const errors: ValidationError[] = [];

    if (!item || typeof item !== 'string') {
        errors.push({ field: 'item', message: 'Item name is required and must be a string', value: item });
    }

    if (quantity !== undefined && (typeof quantity !== 'number' || quantity < 1 || quantity > 64)) {
        errors.push({ field: 'quantity', message: 'Quantity must be a number between 1 and 64', value: quantity });
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid crafting parameters',
            errors
        });
    }

    next();
}

export function validateMiningInput(req: Request, res: Response, next: NextFunction) {
    const { blockType, count, maxDistance } = req.body;
    const errors: ValidationError[] = [];

    if (!blockType || typeof blockType !== 'string') {
        errors.push({ field: 'blockType', message: 'Block type is required and must be a string', value: blockType });
    }

    if (count !== undefined && (typeof count !== 'number' || count < 1 || count > 1000)) {
        errors.push({ field: 'count', message: 'Count must be a number between 1 and 1000', value: count });
    }

    if (maxDistance !== undefined && (typeof maxDistance !== 'number' || maxDistance < 1 || maxDistance > 128)) {
        errors.push({ field: 'maxDistance', message: 'Max distance must be a number between 1 and 128', value: maxDistance });
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid mining parameters',
            errors
        });
    }

    next();
}