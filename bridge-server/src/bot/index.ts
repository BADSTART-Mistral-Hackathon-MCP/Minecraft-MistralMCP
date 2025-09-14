import mineflayer from 'mineflayer';
import { pathfinder, goals } from 'mineflayer-pathfinder';
import { BotConfig, BotStatus } from '../types';
import { setupBotEvents } from './events';

class MinecraftBot {
    private bot: mineflayer.Bot | null = null;
    private combatActive = false;

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
        this.combatActive = false; // Stop combat when bot disconnects
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

    public async attackNearestEntity(maxDistance = 16, hostileOnly = true): Promise<string> {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        if (this.combatActive) {
            throw new Error('Already in combat - use stop attack to cancel');
        }

        // Start combat in background and return immediately
        this.startCombat(maxDistance, hostileOnly);
        return "Combat started - bot is now attacking";
    }

    private async startCombat(maxDistance: number, hostileOnly: boolean): Promise<void> {
        const bot = this.bot!;
        this.combatActive = true;

        // Find initial target
        let target = bot.nearestEntity(entity => {
            if (!entity || entity === bot.entity) return false;

            const distance = bot.entity.position.distanceTo(entity.position);
            if (distance > maxDistance) return false;

            if (hostileOnly) {
                const hostileMobs = ['Zombie', 'Skeleton', 'Creeper', 'Spider', 'Enderman', 'Witch', 'Slime'];
                return !!(entity.displayName && hostileMobs.includes(entity.displayName));
            }

            return entity.type === 'mob' || entity.type === 'player';
        });

        if (!target) {
            this.combatActive = false;
            bot.chat('No valid targets found');
            return;
        }

        const targetName = target.displayName || target.name || 'entity';
        bot.chat(`Engaging ${targetName}`);

        // Combat loop
        while (target && target.isValid !== false && bot.health > 0 && this.combatActive) {
            const distance = bot.entity.position.distanceTo(target.position);

            // Check if target is out of range
            if (distance > maxDistance) {
                bot.chat(`${targetName} escaped - too far away`);
                break;
            }

            // Move closer if too far to attack (more than 4 blocks)
            if (distance > 4) {
                const goal = new goals.GoalNear(target.position.x, target.position.y, target.position.z, 2);
                bot.pathfinder.setGoal(goal);

                // Wait a bit for movement
                await new Promise(resolve => setTimeout(resolve, 500));
                continue;
            }

            // Stop movement and attack
            bot.pathfinder.setGoal(null);

            // Look at target and attack
            bot.lookAt(target.position.offset(0, target.height / 2, 0));
            bot.attack(target);

            // Wait for attack cooldown
            await new Promise(resolve => setTimeout(resolve, 600));
        }

        // Combat ended
        this.combatActive = false;
        bot.pathfinder.setGoal(null);

        if (bot.health <= 0) {
            bot.chat("I died in combat");
        } else if (!target || target.isValid === false) {
            bot.chat(`${targetName} defeated`);
        }
    }

    public stopAttack(): string {
        if (!this.combatActive) {
            return "Not currently in combat";
        }

        this.combatActive = false;
        if (this.bot) {
            this.bot.pathfinder.setGoal(null);
        }
        return "Attack cancelled";
    }

    public getCombatStatus(): { active: boolean; message: string } {
        return {
            active: this.combatActive,
            message: this.combatActive ? "Bot is currently in combat" : "Bot is not in combat"
        };
    }
}

export default MinecraftBot;