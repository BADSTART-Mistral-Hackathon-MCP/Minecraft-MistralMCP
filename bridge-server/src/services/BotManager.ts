import mineflayer, { Bot, BotEvents } from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import { Vec3 } from 'vec3';
import { Server as SocketIOServer } from 'socket.io';
import { BotState, BotCapabilities, ChatMessage, CombatStatus } from '../types';

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
    async craftItem(item: string, quantity: number = 1, requiresTable: boolean = false): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const startTime = Date.now();
        const mcData = require('minecraft-data')(this.bot.version);
        const recipe = mcData.recipesByName[item];

        if (!recipe) {
            throw new Error(`Recipe for ${item} not found`);
        }

        let craftingTable = null;
        if (recipe.requiresTable || requiresTable) {
            craftingTable = this.bot.findBlock(mcData.blocksByName.crafting_table.id);
            if (!craftingTable) {
                throw new Error('Crafting table required but not found nearby');
            }
        }

        const materialsUsed = recipe.ingredients || [];

        try {
            await this.bot.craft(recipe, quantity, craftingTable ?? undefined);

            this.updateLastActivity();
            this.io.emit('bot_state', this.getBotState());

            return {
                crafted: true,
                item,
                quantity,
                materialsUsed,
                timeElapsed: Date.now() - startTime,
                success: true
            };
        } catch (error: any) {
            return {
                crafted: false,
                item,
                quantity,
                timeElapsed: Date.now() - startTime,
                success: false,
                error: error.message
            };
        }
    }

    async mineBlocks(blockType: string, count: number = 1, maxDistance: number = 32): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const startTime = Date.now();
        const mcData = require('minecraft-data')(this.bot.version);
        const blockId = mcData.blocksByName[blockType]?.id;

        if (!blockId) {
            throw new Error(`Block type ${blockType} not found`);
        }

        const blocksFound: any[] = [];
        let mined = 0;

        try {
            while (mined < count) {
                const block = this.bot.findBlock(blockId);
                if (!block) {
                    break; // No more blocks found
                }

                blocksFound.push({
                    position: { x: block.position.x, y: block.position.y, z: block.position.z },
                    name: block.name
                });

                await this.bot.dig(block);
                mined++;

                this.updateLastActivity();
                this.io.emit('bot_state', this.getBotState());
            }

            return {
                mined,
                requested: count,
                blocksFound,
                timeElapsed: Date.now() - startTime,
                success: mined > 0
            };
        } catch (error: any) {
            return {
                mined,
                requested: count,
                blocksFound,
                timeElapsed: Date.now() - startTime,
                success: false,
                error: error.message
            };
        }
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

    async placeBlock(blockType: string, x: number, y: number, z: number, face: string = 'top'): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);
        const blockItem = mcData.itemsByName[blockType];

        if (!blockItem) {
            throw new Error(`Block item ${blockType} not found`);
        }

        const item = this.bot.inventory.findInventoryItem(blockItem.id, 1, false);
        if (!item) {
            throw new Error(`No ${blockType} in inventory`);
        }

        try {
            const referenceBlock = this.bot.blockAt(new Vec3(x, y - 1, z)); // Block below target position
            if (!referenceBlock) {
                throw new Error('No reference block found');
            }

            await this.bot.equip(item, 'hand');
            await this.bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));

            this.updateLastActivity();
            return { placed: true, blockType, position: { x, y, z } };
        } catch (error: any) {
            return { placed: false, blockType, error: error.message };
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
            throw new Error(`Item ${item} not found`);
        }

        const inventoryItem = this.bot.inventory.findInventoryItem(itemData.id, 1, false);
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

    async dropItem(item: string, quantity: number = 1): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const mcData = require('minecraft-data')(this.bot.version);
        const itemData = mcData.itemsByName[item];

        if (!itemData) {
            throw new Error(`Item ${item} not found`);
        }

        const inventoryItem = this.bot.inventory.findInventoryItem(itemData.id, quantity, false);
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
                // Set up continuous attack until entity is dead or out of range
                const attackInterval = setInterval(() => {
                    const currentEntity = this.bot!.entities[entityId];
                    if (!currentEntity || currentEntity.position.distanceTo(this.bot!.entity.position) > 8) {
                        clearInterval(attackInterval);
                        return;
                    }
                    this.bot!.attack(currentEntity);
                }, 500);
            } else {
                await this.bot.attack(entity);
            }

            this.updateLastActivity();
            return { attacked: true, entityId, continuous, target: entity.name };
        } catch (error: any) {
            return { attacked: false, entityId, error: error.message };
        }
    }

    async attackNearestHostile(mobType?: string, radius: number = 16, continuous: boolean = false): Promise<any> {
        if (!this.bot) throw new Error('Bot not connected');

        const hostileMobs = ['zombie', 'skeleton', 'creeper', 'spider', 'enderman', 'witch'];
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
            return { target: null, attacked: false };
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
        this.defensiveMode = enabled;
        this.defensiveRadius = radius;
        this.isAggressive = aggressive;

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
        const shield = this.bot.inventory.findInventoryItem(mcData.itemsByName.shield?.id, 1, false);

        if (!shield) {
            return { success: false, error: 'No shield in inventory' };
        }

        try {
            if (raised) {
                await this.bot.equip(shield, 'off-hand');
                this.bot.activateItem(); // Raise shield
            } else {
                this.bot.deactivateItem(); // Lower shield
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