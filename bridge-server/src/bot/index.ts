import mineflayer from 'mineflayer';
import { pathfinder, goals } from 'mineflayer-pathfinder';
import { BotConfig, BotStatus } from '../types';
import { setupBotEvents } from './events';
import { Block } from 'prismarine-block';

class MinecraftBot {
    private bot: mineflayer.Bot | null = null;

    public getBotInstance(): mineflayer.Bot | null {
        return this.bot;
    }
    private config: BotConfig;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isReconnecting = false;

    constructor(config: BotConfig) {
        this.config = config;
        this.connect();
    }

    private connect(): void {
        if (this.isReconnecting) return;
        this.isReconnecting = true;

        console.log(`🤖 Connecting bot (attempt ${this.reconnectAttempts + 1})...`);

        this.bot = mineflayer.createBot({
            host: this.config.host,
            port: this.config.port,
            username: this.config.username,
            password: this.config.password,
            version: this.config.version,
            auth: this.config.password ? 'microsoft' : 'offline',
            hideErrors: false
        });

        // Load pathfinder plugin
        this.bot.loadPlugin(pathfinder);

        // Setup event handlers
        setupBotEvents(this.bot);

        // Connection event handlers
        this.bot.once('spawn', () => {
            this.reconnectAttempts = 0;
            this.isReconnecting = false;
        });

        this.bot.on('error', this.onError.bind(this));
        this.bot.on('end', this.onEnd.bind(this));
        this.bot.on('kicked', this.onKicked.bind(this));
    }

    private onError(err: Error): void {
        console.error('❌ Bot error:', err.message);
        this.attemptReconnect();
    }

    private onEnd(reason: string): void {
        console.log('🔌 Bot disconnected:', reason);
        if (reason !== 'disconnect.quitting') {
            this.attemptReconnect();
        }
    }

    private onKicked(reason: string): void {
        console.log('⚠️ Bot was kicked:', reason);
        this.attemptReconnect();
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('💥 Max reconnection attempts reached. Giving up.');
            return;
        }

        if (this.isReconnecting) return;

        this.reconnectAttempts++;
        console.log(`🔄 Reconnecting in 5 seconds... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect();
        }, 5000);
    }

    // Public methods
    public isReady(): boolean {
        return !!(this.bot && this.bot.entity && !this.bot._client.ended);
    }

    public getStatus(): BotStatus {
        if (!this.isReady() || !this.bot) {
            return { connected: false, spawned: false };
        }

        return {
            connected: true,
            spawned: true,
            username: this.bot.username,
            health: this.bot.health,
            food: this.bot.food,
            position: {
                x: this.bot.entity.position.x,
                y: this.bot.entity.position.y,
                z: this.bot.entity.position.z
            },
            gameMode: this.bot.game.gameMode,
            playersOnline: Object.keys(this.bot.players).length
        };
    }

    public async moveTo(x: number, y: number, z: number): Promise<string> {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const bot = this.bot;

        return new Promise((resolve, reject) => {
            const goal = new goals.GoalBlock(x, y, z);
            bot.pathfinder.setGoal(goal);

            const timeout = setTimeout(() => {
                bot.removeAllListeners('goal_reached');
                bot.removeAllListeners('path_update');
                reject(new Error('Movement timeout'));
            }, 30000);

            const onGoalReached = () => {
                clearTimeout(timeout);
                bot.removeAllListeners('goal_reached');
                bot.removeAllListeners('path_update');
                resolve(`Moved to (${x}, ${y}, ${z})`);
            };

            const onPathUpdate = (r: any) => {
                if (r.status === 'noPath') {
                    clearTimeout(timeout);
                    bot.removeAllListeners('goal_reached');
                    bot.removeAllListeners('path_update');
                    reject(new Error('No path found'));
                }
            };

            bot.once('goal_reached', onGoalReached);
            bot.once('path_update', onPathUpdate);
        });
    }

    public followPlayer(playerName: string, distance = 3, continuous = false): string {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const player = this.bot.players[playerName];
        if (!player || !player.entity) {
            throw new Error(`Player ${playerName} not found or not visible`);
        }

        // Use GoalFollow to follow the player
        const goal = new goals.GoalFollow(player.entity, distance);
        this.bot.pathfinder.setGoal(goal, continuous);

        return `Following ${playerName} at ${distance} blocks distance`;
    }

    public stopMovement(): string {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        this.bot.pathfinder.setGoal(null);

        // Also stop any control states that might be active
        this.bot.setControlState('forward', false);
        this.bot.setControlState('back', false);
        this.bot.setControlState('left', false);
        this.bot.setControlState('right', false);
        this.bot.setControlState('jump', false);
        this.bot.setControlState('sprint', false);
        this.bot.setControlState('sneak', false);

        return 'Bot movement stopped';
    }

    public getPosition() {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const pos = this.bot.entity.position;
        return {
            x: Math.round(pos.x * 100) / 100,
            y: Math.round(pos.y * 100) / 100,
            z: Math.round(pos.z * 100) / 100,
            yaw: Math.round(this.bot.entity.yaw * 100) / 100,
            pitch: Math.round(this.bot.entity.pitch * 100) / 100
        };
    }

    public say(message: string): void {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }
        this.bot.chat(message);
    }

    public async mine(blockType: string, maxDistance = 32): Promise<string> {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const block = this.bot.findBlock({
            matching: (block) => block.name === blockType || block.name.includes(blockType),
            maxDistance
        });

        if (!block) {
            throw new Error(`No ${blockType} found within ${maxDistance} blocks`);
        }

        if (!this.bot.canDigBlock(block)) {
            throw new Error(`Cannot mine ${blockType} at this location`);
        }

        // Move to block first
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        this.bot.pathfinder.setGoal(goal);

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Failed to reach block')), 15000);

            this.bot!.once('goal_reached', () => {
                clearTimeout(timeout);
                resolve(undefined);
            });
        });

        // Mine the block
        await this.bot.dig(block);
        return `Mined ${block.name} at (${block.position.x}, ${block.position.y}, ${block.position.z})`;
    }

    public async craft(itemName: string, count = 1): Promise<string> {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const item = this.bot.registry.itemsByName[itemName];
        if (!item) {
            const msg = `❌ Item "${itemName}" not found.`;
            this.bot.chat(msg);
            return msg;
        }

        let recipe = this.bot.recipesFor(item.id, null, count, false)[0];
        let craftingTable: Block | null = null;

        // If no recipe in 2x2 grid, try with a crafting table
        if (!recipe) {
            craftingTable = this.bot.findBlock({
                matching: this.bot.registry.blocksByName.crafting_table.id,
                maxDistance: 10
            });

            if (!craftingTable) {
                const msg = `❌ No recipe for "${itemName}" in inventory, and no crafting table nearby.`;
                this.bot.chat(msg);
                return msg;
            }

            recipe = this.bot.recipesFor(item.id, null, null, true)[0];

            if (!recipe) {
                const msg = `❌ Even with a crafting table, no recipe found for "${itemName}".`;
                this.bot.chat(msg);
                return msg;
            }

            // Move to the crafting table if required
            try {
                const { GoalNear } = goals;
                await this.bot.pathfinder.goto(
                    new GoalNear(
                        craftingTable.position.x,
                        craftingTable.position.y,
                        craftingTable.position.z,
                        1
                    )
                );
            } catch {
                const msg = `❌ Cannot reach the crafting table to craft "${itemName}".`;
                this.bot.chat(msg);
                return msg;
            }
        }

        // Check if we have all ingredients
        const missing: string[] = [];
        console.log('Recipe ingredients:', recipe);
        for (const ing of recipe.delta) {
            const needed = - ing.count;
            const have = this.bot.inventory.count(ing.id, null);
            if (have < needed) {
                const ingName = this.bot.registry.items[ing.id].name;
                missing.push(`${needed - have}x ${ingName}`);
            }
        }

        if (missing.length > 0) {
            const msg = `❌ Cannot craft "${itemName}". Missing: ${missing.join(', ')}`;
            this.bot.chat(msg);
            return msg;
        }

        try {
            await this.bot.craft(recipe, count, craftingTable ?? undefined);
            const msg = `✅ Crafted ${count}x ${itemName}.`;
            this.bot.chat(msg);
            return msg;
        } catch (err) {
            const msg = `❌ Failed to craft "${itemName}": ${(err as Error).message}`;
            this.bot.chat(msg);
            return msg;
        }
    }

    public dropItem(itemName: string, count = 1): string {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const item = this.bot.registry.itemsByName[itemName];
        if (!item) {
            throw new Error(`Item "${itemName}" not found`);
        }

        const heldItem = this.bot.inventory.findInventoryItem(item.id, null, false);
        if (!heldItem) {
            throw new Error(`You do not have any "${itemName}" to drop`);
        }

        const toDrop = Math.min(count, heldItem.count);
        this.bot.toss(heldItem.type, null, toDrop);
        return `Dropped ${toDrop}x ${itemName}`;
    }

    public getInventory() {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const items = this.bot.inventory.items();
        return items.map(item => ({
            name: item.name,
            displayName: item.displayName,
            count: item.count,
            slot: item.slot
        }));
    }
}

export default MinecraftBot;