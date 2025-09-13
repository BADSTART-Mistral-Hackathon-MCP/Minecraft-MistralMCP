import mineflayer from 'mineflayer';
import { pathfinder, Movements, goals } from 'mineflayer-pathfinder';
import { BotConfig, BotStatus } from './types';

class MinecraftBot {
    private bot: mineflayer.Bot | null = null;
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
            hideErrors: false // Set to true to hide protocol errors
        });

        // Load pathfinder plugin
        this.bot.loadPlugin(pathfinder);

        // Event handlers
        this.bot.once('spawn', this.onSpawn.bind(this));
        this.bot.on('error', this.onError.bind(this));
        this.bot.on('end', this.onEnd.bind(this));
        this.bot.on('kicked', this.onKicked.bind(this));
    }

    private onSpawn(): void {
        console.log('✅ Bot spawned successfully!');
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        if (this.bot) {
            // Initialize pathfinder movements
            const defaultMove = new Movements(this.bot);
            this.bot.pathfinder.setMovements(defaultMove);

            console.log(`📊 Health: ${this.bot.health}, Food: ${this.bot.food}`);
            console.log(`📍 Position: (${this.bot.entity.position.x.toFixed(1)}, ${this.bot.entity.position.y.toFixed(1)}, ${this.bot.entity.position.z.toFixed(1)})`);
        }
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

    // Public methods for API
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

        const bot = this.bot; // Capture reference to avoid null checking issues

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
            throw new Error(`Item ${itemName} not found`);
        }

        const recipe = this.bot.recipesFor(item.id, null, count, null)[0];
        if (!recipe) {
            throw new Error(`No recipe found for ${itemName}`);
        }

        await this.bot.craft(recipe, count);
        return `Crafted ${count}x ${itemName}`;
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