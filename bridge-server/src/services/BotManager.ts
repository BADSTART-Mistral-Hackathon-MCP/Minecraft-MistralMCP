import mineflayer, { Bot, BotEvents } from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { Server as SocketIOServer } from 'socket.io';
import { BotState, BotCapabilities, ChatMessage, CombatStatus } from '../types';
import { Block } from 'prismarine-block';

export class BotManager {
    private bot: Bot | null = null;
    private movements: any;
    private io: SocketIOServer;
    private connectTime: number | null = null;
    private lastActivity: number = Date.now();
    private chatHistory: ChatMessage[] = [];
    private defensiveMode = false;
    private defensiveRadius = 8;
    private isAggressive = false;
    private _defensiveHandler: (() => Promise<void>) | null = null;

    constructor(io: SocketIOServer) {
        this.io = io;
    }

    async connectBot(): Promise<void> {
        if (this.bot) {
            console.log('Bot already connected');
            return;
        }

        try {
            this.bot = mineflayer.createBot({
                host: process.env.MINECRAFT_HOST,
                port: parseInt(process.env.MINECRAFT_PORT || '25565'),
                username: process.env.BOT_USERNAME || 'Elio',
                version: process.env.MINECRAFT_VERSION,
            });

            this.bot.loadPlugin(pathfinder);

            this.bot.once('spawn', () => {
                console.log('[DEBUG] Bot spawned in game');
                console.log(`[DEBUG] Bot username: ${this.bot?.username}`);
                console.log(`[DEBUG] Bot entity ID: ${this.bot?.entity?.id}`);
                this.connectTime = Date.now();
                this.movements = new Movements(this.bot!);
                this.bot!.pathfinder.setMovements(this.movements);
                this.setupBotEvents();
                this.io.emit('bot_connected', { timestamp: this.connectTime });
            });

            this.bot.on('error', (error) => {
                console.error('Bot error:', error);
                this.io.emit('bot_error', { message: error.message, timestamp: Date.now() });
            });

            this.bot.on('end', (reason: string) => {
                console.warn('[DEBUG] Bot disconnected from server');
                console.warn(`[DEBUG] Disconnect reason: ${reason || 'unknown'}`);
                console.warn(`[DEBUG] Bot connected before disconnect? ${this.bot?.entity !== undefined}`);
                this.bot = null;
                this.connectTime = null;
                this.io.emit('bot_disconnected', { timestamp: Date.now() });
            });

        } catch (error) {
            console.error('Failed to connect bot:', error);
            throw error;
        }
    }

    private setupBotEvents(): void {
        if (!this.bot) return;

        // Chat monitoring
        this.bot.on('chat', (username, message) => {
            const chatMsg: ChatMessage = {
                username,
                message,
                timestamp: Date.now()
            };

            this.chatHistory.push(chatMsg);
            if (this.chatHistory.length > 100) {
                this.chatHistory = this.chatHistory.slice(-50);
            }

            this.io.emit('chat_message', chatMsg);
        });

        // Player events
        this.bot.on('playerJoined', (player) => {
            this.io.emit('player_joined', {
                username: player.username,
                timestamp: Date.now()
            });
        });

        this.bot.on('playerLeft', (player) => {
            this.io.emit('player_left', {
                username: player.username,
                timestamp: Date.now()
            });
        });

        // Health and status updates
        this.bot.on('health', () => {
            this.updateLastActivity();
            this.io.emit('bot_state', this.getBotState());
        });

        this.bot.on('food' as keyof BotEvents, () => {
            this.updateLastActivity();
            this.io.emit('bot_state', this.getBotState());
        });

        // Goal reached
        this.bot.on('goal_reached', (goal) => {
            this.updateLastActivity();
            this.io.emit('goal_reached', { goal, timestamp: Date.now() });
        });

        // Combat events
        this.bot.on('entityHurt', (entity) => {
            if (entity === this.bot!.entity) {
                this.io.emit('bot_hurt', {
                    health: this.bot!.health,
                    timestamp: Date.now()
                });

                if (this.defensiveMode) {
                    this.handleDefensiveResponse();
                }
            }
        });

        // Periodic state updates
        setInterval(() => {
            if (this.bot) {
                this.io.emit('bot_state', this.getBotState());
            }
        }, 5000);
    }

    private updateLastActivity(): void {
        this.lastActivity = Date.now();
    }

    private handleDefensiveResponse(): void {
        if (!this.bot || !this.defensiveMode) return;

        const threats = this.getNearbyThreats(this.defensiveRadius);
        if (threats.length > 0) {
            if (this.isAggressive) {
                // Attack the nearest threat
                this.attackEntity(threats[0].id, false);
            } else {
                // Flee from threats
                this.fleeFromHostiles(16);
            }
        }
    }

    // Public methods
    isConnected(): boolean {
        return this.bot !== null && this.bot.entity !== undefined;
    }

    getBotUptime(): number {
        return this.connectTime ? Date.now() - this.connectTime : 0;
    }

    getLastActivity(): number {
        return this.lastActivity;
    }

    getBotState(): BotState {
        if (!this.bot) {
            throw new Error('Bot not connected');
        }

        const inventory = this.bot.inventory.items().map(item => ({
            name: item.name,
            count: item.count,
            slot: item.slot
        }));

        const nearbyPlayers = Object.values(this.bot.players)
            .filter(player => player.entity)
            .map(player => ({
                username: player.username,
                position: {
                    x: player.entity!.position.x,
                    y: player.entity!.position.y,
                    z: player.entity!.position.z
                },
                distance: player.entity!.position.distanceTo(this.bot!.entity.position)
            }));

        const nearbyMobs = Object.values(this.bot.entities)
            .filter(entity =>
                entity.type === 'mob' &&
                entity.position.distanceTo(this.bot!.entity.position) < 16
            )
            .map(entity => ({
                type: entity.name || 'unknown',
                position: {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                },
                id: entity.id,
                distance: entity.position.distanceTo(this.bot!.entity.position)
            }));

        return {
            health: this.bot.health,
            food: this.bot.food,
            experience: this.bot.experience,
            position: {
                x: this.bot.entity.position.x,
                y: this.bot.entity.position.y,
                z: this.bot.entity.position.z
            },
            inventory,
            nearbyPlayers,
            nearbyMobs,
            isAlive: this.bot.health > 0,
            gameMode: this.bot.game.gameMode,
            dimension: this.bot.game.dimension,
            weather: {
                raining: this.bot.isRaining,
                thundering: this.bot.thunderState > 0
            }
        };
    }

    getBotCapabilities(): BotCapabilities {
        return {
            canMove: true,
            canJump: true,
            canFly: false, // Would need creative mode detection
            canCraft: true,
            canMine: true,
            canAttack: true,
            canUseItems: true,
            canChat: true,
            pathfinding: true,
            inventoryManagement: true
        };
    }

    // Movement methods
    async moveTo(x: number, y: number, z: number): Promise<void> {
        if (!this.bot) throw new Error('Bot not connected');

        this.updateLastActivity();
        const goal = new goals.GoalBlock(x, y, z);
        await this.bot.pathfinder.goto(goal);
    }

    async followPlayer(username: string, distance: number = 2): Promise<void> {
        if (!this.bot) throw new Error('Bot not connected');

        const player = this.bot.players[username];
        if (!player || !player.entity) {
            throw new Error(`Player ${username} not found`);
        }

        this.updateLastActivity();
        const goal = new goals.GoalFollow(player.entity, distance);
        this.bot.pathfinder.setGoal(goal, true);
    }

    async goToLocation(location: string, type: string = 'nearest'): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        // This would need to be expanded based on your specific location system
        const mcData = require('minecraft-data')(this.bot.version);

        // Example: find specific block types
        if (mcData.blocksByName[location]) {
            const blockId = mcData.blocksByName[location].id;
            const block = this.bot.findBlock(blockId);

            if (block) {
                await this.moveTo(block.position.x, block.position.y, block.position.z);
                return block.position;
            } else {
                throw new Error(`No ${location} found nearby`);
            }
        }

        throw new Error(`Unknown location: ${location}`);
    }

    stopMovement(): void {
        if (!this.bot) throw new Error('Bot not connected');

        this.bot.pathfinder.setGoal(null);
        this.updateLastActivity();
    }

    getCurrentPath(): any {
        if (!this.bot) throw new Error('Bot not connected');

        return {
            hasGoal: this.bot.pathfinder.goal !== null,
            goal: this.bot.pathfinder.goal,
            isMoving: this.bot.pathfinder.isMoving(),
            position: this.bot.entity.position
        };
    }

    async lookAt(x: number, y: number, z: number): Promise<void> {
        if (!this.bot) throw new Error('Bot not connected');

        const position = new Vec3(x, y, z);
        await this.bot.lookAt(position);
        this.updateLastActivity();
    }

    async lookAtEntity(entityId: number): Promise<void> {
        if (!this.bot) throw new Error('Bot not connected');

        const entity = this.bot.entities[entityId];
        if (!entity) {
            throw new Error(`Entity ${entityId} not found`);
        }

        await this.bot.lookAt(entity.position);
        this.updateLastActivity();
    }

    // Communication methods
    say(message: string): void {
        if (!this.bot) throw new Error('Bot not connected');

        this.bot.chat(message);
        this.updateLastActivity();
    }

    whisper(username: string, message: string): void {
        if (!this.bot) throw new Error('Bot not connected');

        this.bot.whisper(username, message);
        this.updateLastActivity();
    }

    getChatHistory(limit: number = 50, username?: string): ChatMessage[] {
        let history = this.chatHistory.slice(-limit);

        if (username) {
            history = history.filter(msg => msg.username === username);
        }

        return history;
    }

    async generateResponse(message: string, username?: string, context?: any): Promise<string> {
        // This is a simple response generator - in practice, this would integrate with your AI system
        const responses = [
            `Hello ${username}!`,
            `I heard you say: ${message}`,
            `How can I help you today?`,
            `That's interesting, ${username}!`
        ];

        return responses[Math.floor(Math.random() * responses.length)];
    }

    getInventory(): any[] {
        if (!this.bot) throw new Error('Bot not connected');

        return this.bot.inventory.items().map(item => ({
            name: item.name,
            displayName: item.displayName,
            count: item.count,
            slot: item.slot,
            durability: item.durabilityUsed,
            maxDurability: item.maxDurability
        }));
    }

    getInventorySummary(): any {
        if (!this.bot) throw new Error('Bot not connected');

        const items = this.getInventory();
        const summary = items.reduce((acc, item) => {
            acc[item.name] = (acc[item.name] || 0) + item.count;
            return acc;
        }, {} as Record<string, number>);

        return {
            totalItems: items.length,
            freeSlots: 36 - items.length,
            itemTypes: Object.keys(summary).length,
            summary
        };
    }

    getNearbyEntities(radius: number = 16): any {
        if (!this.bot) throw new Error('Bot not connected');

        const entities = Object.values(this.bot.entities)
            .filter(entity => entity.position.distanceTo(this.bot!.entity.position) <= radius)
            .map(entity => ({
                id: entity.id,
                name: entity.name || entity.type,
                type: entity.type,
                position: {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                },
                distance: entity.position.distanceTo(this.bot!.entity.position)
            }));

        return {
            entities,
            count: entities.length,
            radius,
            players: entities.filter(e => e.type === 'player'),
            mobs: entities.filter(e => e.type === 'mob'),
            items: entities.filter(e => e.type === 'object')
        };
    }

    // Action methods
    async craftItem(item: string, quantity: number = 1): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const startTime = Date.now();
        const mcData = require('minecraft-data')(this.bot.version);

        // Normalize item name
        const cleanItem = item.replace(/^minecraft:/, "");
        const itemId = mcData.itemsByName[cleanItem]?.id;
        if (!itemId) {
            return { success: false, error: `Item ${item} not found in mcData`, item: cleanItem, crafted: false };
        }

        // Try without table first
        let recipe = this.bot.recipesFor(itemId, null, quantity, false)[0];
        let craftingTable: any = null;

        // Retry with table if none
        if (!recipe) {
            craftingTable = this.bot.findBlock({
                matching: mcData.blocksByName.crafting_table.id,
                maxDistance: 32
            });

            if (!craftingTable) {
                return { success: false, error: `Crafting table required but not found nearby`, item: cleanItem, crafted: false };
            }

            recipe = this.bot.recipesFor(itemId, null, quantity, true)[0];
            if (!recipe) {
                return { success: false, error: `No recipe found for ${cleanItem}`, item: cleanItem, crafted: false };
            }

            // Move near crafting table
            try {
                const { GoalNear } = require('mineflayer-pathfinder').goals;
                await this.bot.pathfinder.goto(new GoalNear(craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 1));
            } catch {
                return { success: false, error: `Cannot reach crafting table for ${cleanItem}`, item: cleanItem, crafted: false };
            }
        }

        // Check ingredients
        const missingItems: string[] = [];
        for (const ing of recipe.delta) {
            if (ing.count < 0) {
                const required = -ing.count * quantity;
                const have = this.bot.inventory.count(ing.id, null);
                if (have < required) {
                    missingItems.push(`${required - have}x ${mcData.items[ing.id].name}`);
                }
            }
        }
        if (missingItems.length > 0) {
            return { success: false, error: `Missing materials: ${missingItems.join(', ')}`, item: cleanItem, crafted: false };
        }

        // Craft
        try {
            await this.bot.craft(recipe, quantity, craftingTable ?? undefined);
            this.updateLastActivity();
            this.io.emit('bot_state', this.getBotState());

            return { success: true, message: `Crafted ${quantity} ${cleanItem}`, item: cleanItem, crafted: true };
        } catch (err: any) {
            return { success: false, error: `Craft failed: ${err.message}`, item: cleanItem, crafted: false };
        }
    }


    async mineBlocks(blockType: string, count: number = 1): Promise<any> {
        if (!this.bot) throw new Error("Bot not connected");

        const startTime = Date.now();
        const mcData = require("minecraft-data")(this.bot.version);

        // Normalize block type
        const cleanBlockType = blockType.replace(/^minecraft:/, "");
        const blockId = mcData.blocksByName[cleanBlockType]?.id;

        if (!blockId) {
            throw new Error(`Block type ${blockType} not found in mcData`);
        }

        let mined = 0;
        const blocksFound: any[] = [];

        try {
            while (mined < count) {
                // 🔍 Find nearest block of that type
                const block = this.bot.findBlock({
                    matching: blockId,
                    maxDistance: 32,
                });

                if (!block) {
                    break; // nothing nearby
                }

                blocksFound.push({ position: block.position, name: block.name });

                // 🚶 Move closer if too far away
                if (block.position.distanceTo(this.bot.entity.position) > 4) {
                    await this.moveTo(block.position.x, block.position.y, block.position.z);
                }

                // 🔨 Equip best tool
                const tool = this.getBestTool(block, mcData);
                if (tool) {
                    await this.bot.equip(tool, "hand");
                } else {
                    console.warn(
                        `⚠️ No suitable tool found for ${block.name}, mining may fail.`
                    );
                }

                // ⛏️ Check if block is mineable
                if (!this.bot.canDigBlock(block)) {
                    return {
                        mined,
                        requested: count,
                        blocksFound,
                        timeElapsed: Date.now() - startTime,
                        success: false,
                        error: `Cannot dig block: ${block.name} with current tool`,
                    };
                }

                // 🪓 Mine it
                await this.bot.dig(block);
                mined++;

                this.updateLastActivity();
                this.io.emit("bot_state", this.getBotState());
            }

            return {
                mined,
                requested: count,
                blocksFound,
                timeElapsed: Date.now() - startTime,
                success: mined > 0,
            };
        } catch (error: any) {
            return {
                mined,
                requested: count,
                blocksFound,
                timeElapsed: Date.now() - startTime,
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Selects the best tool available in inventory for the given block.
     */
    getBestTool(block: any, mcData: any) {
        if (!block) return null;

        const tools = this.bot?.inventory.items().filter((item) =>
            item.name.includes("pickaxe") ||
            item.name.includes("shovel") ||
            item.name.includes("axe")
        );

        if (tools?.length === 0) return null;

        // Example: prefer pickaxe for stone/cobblestone, axe for logs, shovel for sand/gravel
        if (block.name.includes("stone") || block.name.includes("ore")) {
            return tools?.find((t) => t.name.includes("pickaxe")) || null;
        }
        if (block.name.includes("log")) {
            return tools?.find((t) => t.name.includes("axe")) || null;
        }
        if (block.name.includes("sand") || block.name.includes("gravel") || block.name.includes("dirt")) {
            return tools?.find((t) => t.name.includes("shovel")) || null;
        }

        if (!tools || tools.length === 0) return null;

        return tools[0];
    }



    async collectItems(itemType?: string, radius: number = 16): Promise<any[]> {
        if (!this.bot) throw new Error('Bot not connected');



        const items = Object.values(this.bot.entities)
            .filter(entity => {
                if (entity.type !== 'object') return false;
                if (entity.position.distanceTo(this.bot!.entity.position) > radius) return false;
                if (itemType && entity.name !== itemType) return false;
                return true;
            });

        const collected = [];
        for (const item of items) {
            try {
                // Move close to item and collect it
                await this.bot.pathfinder.goto(new goals.GoalNear(item.position.x, item.position.y, item.position.z, 1));
                collected.push({
                    name: item.name,
                    position: { x: item.position.x, y: item.position.y, z: item.position.z }
                });
                this.updateLastActivity();
            } catch (error) {
                console.warn(`Failed to collect item ${item.name}:`, error);
            }
        }

        return collected;
    }

    async placeBlock(
        blockType: string,
        x?: number,
        y?: number,
        z?: number,
        face: string = 'top'
    ): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);
        const blockItem = mcData.itemsByName[blockType];
        if (!blockItem) {
            return { success: false, error: `Block item ${blockType} not found in mcData`, blockType };
        }

        const item = this.bot.inventory.items().find(i => i.type === blockItem.id);
        if (!item) {
            return { success: false, error: `No ${blockType} in inventory`, blockType };
        }

        try {
            await this.bot.equip(item, 'hand');

            // Better positioning logic
            let targetX = x ?? Math.floor(this.bot.entity.position.x);
            let targetY = y ?? Math.floor(this.bot.entity.position.y);
            let targetZ = z ?? Math.floor(this.bot.entity.position.z);

            // If no specific coordinates provided, place in front of bot
            if (x === undefined && y === undefined && z === undefined) {
                const yaw = this.bot.entity.yaw;
                targetX = Math.floor(this.bot.entity.position.x + Math.cos(yaw + Math.PI) * 2);
                targetZ = Math.floor(this.bot.entity.position.z + Math.sin(yaw + Math.PI) * 2);
                targetY = Math.floor(this.bot.entity.position.y);
            }

            // Find a solid reference block to place against
            let referenceBlock = this.bot.blockAt(new Vec3(targetX, targetY - 1, targetZ));

            // If no solid block below, try to find any nearby solid block
            if (!referenceBlock || referenceBlock.name === 'air') {
                // Search for nearby solid blocks
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            const testBlock = this.bot.blockAt(new Vec3(targetX + dx, targetY + dy, targetZ + dz));
                            if (testBlock && testBlock.name !== 'air' && testBlock.material !== 'plant') {
                                referenceBlock = testBlock;
                                targetX = referenceBlock.position.x;
                                targetY = referenceBlock.position.y + 1;
                                targetZ = referenceBlock.position.z;
                                break;
                            }
                        }
                        if (referenceBlock && referenceBlock.name !== 'air') break;
                    }
                    if (referenceBlock && referenceBlock.name !== 'air') break;
                }
            }

            if (!referenceBlock || referenceBlock.name === 'air') {
                return { success: false, error: 'No solid block found to place against', blockType };
            }

            // Check if target position is already occupied
            const targetBlock = this.bot.blockAt(new Vec3(targetX, targetY, targetZ));
            if (targetBlock && targetBlock.name !== 'air') {
                return { success: false, error: `Target position ${targetX},${targetY},${targetZ} is already occupied by ${targetBlock.name}`, blockType };
            }

            const faceVectors: Record<string, Vec3> = {
                top: new Vec3(0, 1, 0),
                bottom: new Vec3(0, -1, 0),
                north: new Vec3(0, 0, -1),
                south: new Vec3(0, 0, 1),
                west: new Vec3(-1, 0, 0),
                east: new Vec3(1, 0, 0),
            };

            const faceVec = faceVectors[face] || new Vec3(0, 1, 0);

            // Add timeout and better error handling
            await Promise.race([
                this.bot.placeBlock(referenceBlock, faceVec),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Placement timeout after 3 seconds')), 3000)
                )
            ]);

            this.updateLastActivity();
            return {
                success: true,
                message: `Placed ${blockType} at ${targetX},${targetY},${targetZ}`,
                blockType,
                position: { x: targetX, y: targetY, z: targetZ },
                face,
                details: { placed: true }
            };
        } catch (error: any) {
            return { success: false, error: error.message, blockType };
        }
    }
    async useItem(x?: number, y?: number, z?: number, item?: string, face: string = 'top'): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        try {
            if (item) {
                const mcData = require('minecraft-data')(this.bot.version);
                const itemData = mcData.itemsByName[item];
                if (!itemData) {
                    throw new Error(`Item ${item} not found`);
                }

                const inventoryItem = this.bot.inventory.findInventoryItem(itemData.id, 1, false);
                if (!inventoryItem) {
                    throw new Error(`No ${item} in inventory`);
                }

                await this.bot.equip(inventoryItem, 'hand');
            }

            if (x !== undefined && y !== undefined && z !== undefined) {
                const block = this.bot.blockAt(new Vec3(x, y, z));
                if (block) {
                    await this.bot.activateBlock(block);
                }
            } else {
                await this.bot.activateItem();
            }

            this.updateLastActivity();
            return { used: true, item, position: x !== undefined ? { x, y, z } : null };
        } catch (error: any) {
            return { used: false, item, error: error.message };
        }
    }

    async equipItem(item: string, slot: string = 'hand'): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);
        const itemData = mcData.itemsByName[item];

        if (!itemData) {
            throw new Error(`Item ${item} not found in mcData`);
        }

        const inventoryItem = this.bot.inventory.items().find(i => i.type === itemData.id);
        if (!inventoryItem) {
            throw new Error(`No ${item} in inventory`);
        }

        try {
            await this.bot.equip(inventoryItem, slot as any);
            this.updateLastActivity();
            return { equipped: true, item, slot };
        } catch (error: any) {
            return { equipped: false, item, error: error.message };
        }
    }

    async dropItem(item: string, quantity: number): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);
        const itemData = mcData.itemsByName[item];

        if (!itemData) {
            throw new Error(`Item ${item} not found in mcData`);
        }

        const inventoryItem = this.bot.inventory.items().find(i => i.type === itemData.id);
        if (!inventoryItem) {
            throw new Error(`No ${item} in inventory`);
        }

        try {
            await this.bot.toss(itemData.id, null, quantity);
            this.updateLastActivity();
            return { dropped: true, item, quantity };
        } catch (error: any) {
            return { dropped: false, item, error: error.message };
        }
    }


    getRecipes(item?: string): any[] {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);

        if (item) {
            const recipe = mcData.recipesByName[item];
            return recipe ? [recipe] : [];
        }

        return Object.values(mcData.recipes || {});
    }

    // Combat methods
    async attackEntity(entityId: number, continuous: boolean = false): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const entity = this.bot.entities[entityId];
        if (!entity) {
            throw new Error(`Entity with ID ${entityId} not found`);
        }

        try {
            if (continuous) {
                this.bot.attack(entity);

                const attackInterval = setInterval(() => {
                    const currentEntity = this.bot!.entities[entityId];
                    if (
                        !currentEntity ||
                        currentEntity.position.distanceTo(this.bot!.entity.position) > 8 ||
                        (currentEntity.health !== undefined && currentEntity.health <= 0)
                    ) {
                        clearInterval(attackInterval);
                        return;
                    }
                    this.bot!.attack(currentEntity);
                }, 500);
            } else {
                this.bot.attack(entity);
            }

            this.updateLastActivity();
            return {
                attacked: true,
                entityId,
                continuous,
                target: entity.name || entity.displayName || 'unknown'
            };
        } catch (error: any) {
            return { attacked: false, entityId, error: error.message };
        }
    }

    async attackNearestHostile(mobType?: string, radius: number = 16, continuous: boolean = false): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'pillager'];
        const entities = Object.values(this.bot.entities)
            .filter(entity => {
                if (entity.type !== 'mob') return false;
                if (entity.position.distanceTo(this.bot!.entity.position) > radius) return false;
                if (mobType && entity.name !== mobType) return false;
                if (!mobType && !hostileMobs.includes(entity.name || '')) return false;
                return true;
            })
            .sort((a, b) =>
                a.position.distanceTo(this.bot!.entity.position) - b.position.distanceTo(this.bot!.entity.position)
            );

        if (entities.length === 0) {
            return { target: null, attacked: false, reason: 'No hostiles found' };
        }

        const target = entities[0];
        const result = await this.attackEntity(target.id, continuous);

        return {
            target: {
                id: target.id,
                type: target.name,
                distance: target.position.distanceTo(this.bot.entity.position)
            },
            ...result
        };
    }

    setDefensiveMode(enabled: boolean, radius: number = 8, aggressive: boolean = false): any {
        if (!this.bot) throw new Error('Bot not connected');

        this.defensiveMode = enabled;
        this.defensiveRadius = radius;
        this.isAggressive = aggressive;

        if (this._defensiveHandler) {
            // remove old handler if already active
            this.bot.removeListener('physicsTick', this._defensiveHandler);
            this._defensiveHandler = null;
        }

        if (enabled) {
            this._defensiveHandler = async () => {
                try {
                    const threats = this.getNearbyThreats(radius);

                    if (threats.length === 0) return;

                    const threatLevel = this.assessThreatLevel(threats);

                    if (aggressive) {
                        // Aggressive: attack nearest hostile
                        const nearest = threats[0];
                        await this.attackEntity(nearest.id, true);
                    } else {
                        // Defensive: flee instead of attacking
                        if (threatLevel === 'HIGH' || threatLevel === 'MEDIUM') {
                            await this.fleeFromHostiles(radius * 2);
                        } else {
                            // Raise shield if available
                            await this.useShield(true);
                        }
                    }
                } catch (err) {
                    this.bot?.emit('error', new Error(`Defensive handler error: ${err}`));
                }
            };

            this.bot.on('physicsTick', this._defensiveHandler);
        }

        return {
            defensiveMode: this.defensiveMode,
            radius: this.defensiveRadius,
            aggressive: this.isAggressive
        };
    }


    async fleeFromHostiles(distance: number = 16, direction?: string): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const threats = this.getNearbyThreats(this.defensiveRadius);
        if (threats.length === 0) {
            return { fled: false, reason: 'No threats detected' };
        }

        // Calculate flee direction (opposite of average threat position)
        const avgThreatPos = threats.reduce((acc, threat) => ({
            x: acc.x + threat.position.x,
            z: acc.z + threat.position.z
        }), { x: 0, z: 0 });

        avgThreatPos.x /= threats.length;
        avgThreatPos.z /= threats.length;

        const fleeX = this.bot.entity.position.x + (this.bot.entity.position.x - avgThreatPos.x) * 2;
        const fleeZ = this.bot.entity.position.z + (this.bot.entity.position.z - avgThreatPos.z) * 2;
        const fleeY = this.bot.entity.position.y;

        try {
            await this.moveTo(fleeX, fleeY, fleeZ);
            return {
                fled: true,
                direction: direction || 'auto',
                destination: { x: fleeX, y: fleeY, z: fleeZ }
            };
        } catch (error: any) {
            return { fled: false, error: error.message };
        }
    }

    async useShield(raised: boolean): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);
        const shieldItem = mcData.itemsByName.shield;

        if (!shieldItem) {
            return { success: false, error: 'Shield not defined in mcData for this version' };
        }

        const shield = this.bot.inventory.items().find(i => i.type === shieldItem.id);

        if (!shield) {
            return { success: false, error: 'No shield in inventory' };
        }

        try {
            if (raised) {
                await this.bot.equip(shield, 'off-hand');
                this.bot.activateItem(); // raise shield
            } else {
                this.bot.deactivateItem(); // lower shield
            }

            return { success: true, raised, shield: shield.name };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }


    getNearbyThreats(radius: number = 16): any[] {
        if (!this.bot) return [];

        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch', 'pillager'];

        return Object.values(this.bot.entities)
            .filter(entity => {
                if (entity.type !== 'mob') return false;
                if (entity.position.distanceTo(this.bot!.entity.position) > radius) return false;
                return hostileMobs.includes(entity.name || '');
            })
            .map(entity => ({
                id: entity.id,
                type: entity.name || 'unknown',
                position: {
                    x: entity.position.x,
                    y: entity.position.y,
                    z: entity.position.z
                },
                distance: entity.position.distanceTo(this.bot!.entity.position)
            }))
            .sort((a, b) => a.distance - b.distance);
    }

    assessThreatLevel(threats: any[]): string {
        if (threats.length === 0) return 'SAFE';
        if (threats.length === 1 && threats[0].distance > 8) return 'LOW';
        if (threats.length <= 2 && threats[0].distance > 4) return 'MEDIUM';
        return 'HIGH';
    }

    getCombatStatus(): any {
        if (!this.bot) throw new Error('Bot not connected');

        const threats = this.getNearbyThreats(16);
        const weapon = this.bot.heldItem;

        return {
            inCombat: threats.length > 0 && threats[0].distance < 8,
            health: this.bot.health,
            food: this.bot.food,
            armor: 0, // Would need to calculate from armor items
            weapon: weapon ? { name: weapon.name, count: weapon.count } : null,
            threats,
            defensiveMode: this.defensiveMode,
            threatLevel: this.assessThreatLevel(threats)
        };
    }
}