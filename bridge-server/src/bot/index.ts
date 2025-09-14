import mineflayer from 'mineflayer';
import { pathfinder, goals } from 'mineflayer-pathfinder';
import { BotConfig, BotStatus } from '../types';
import { setupBotEvents } from './events';

class MinecraftBot {
    private bot: mineflayer.Bot | null = null;
    private config: BotConfig;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private isReconnecting = false;
    private autoFollowInterval: NodeJS.Timeout | null = null;
    private autoFollowTarget: string | null = null;
    private autoFollowDistance = 2;

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
            this.onSpawn();
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

    public followPlayer(playerName: string, distance = 3): string {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const player = this.bot.players[playerName];
        if (!player || !player.entity) {
            throw new Error(`Player ${playerName} not found or not visible`);
        }

        // Use GoalFollow to follow the player
        const goal = new goals.GoalFollow(player.entity, distance);
        this.bot.pathfinder.setGoal(goal, true);

        return `Following ${playerName} at ${distance} blocks distance`;
    }

    public followNearestPlayer(distance = 2): string {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }
        const name = this.findNearestPlayerName();
        if (!name) throw new Error('No players found to follow');
        this.autoFollowTarget = name;
        return this.followPlayer(name, distance);
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

    private findNearestPlayerName(): string | null {
        if (!this.isReady() || !this.bot) return null;
        const self = this.bot.entity?.position;
        if (!self) return null;
        let best: { name: string; d2: number } | null = null;
        for (const [name, p] of Object.entries(this.bot.players)) {
            if (!p || !p.entity) continue;
            if (name === this.bot.username) continue;
            const pos = p.entity.position;
            const dx = pos.x - self.x;
            const dy = pos.y - self.y;
            const dz = pos.z - self.z;
            const d2 = dx*dx + dy*dy + dz*dz;
            if (!best || d2 < best.d2) best = { name, d2 };
        }
        return best?.name || null;
    }

    private async teleportNearPlayer(playerName: string, distance = 2): Promise<boolean> {
        if (!this.isReady() || !this.bot) return false;
        const player = this.bot.players[playerName];
        if (!player || !player.entity) return false;
        const pos = player.entity.position.clone();
        // Offset by +distance on X axis to avoid overlapping
        const tx = Math.floor(pos.x + distance);
        const ty = Math.floor(pos.y);
        const tz = Math.floor(pos.z);
        try {
            const { ok } = await this.runCommand(`/tp ${this.bot.username} ${tx} ${ty} ${tz}`, 2000);
            return ok;
        } catch {
            return false;
        }
    }

    private startAutoFollow(): void {
        if (!this.isReady() || !this.bot) return;
        // Try to pick nearest player immediately
        try {
            const name = this.findNearestPlayerName();
            if (name) {
                this.autoFollowTarget = name;
                this.followPlayer(name, this.autoFollowDistance);
                // Attempt to TP near the target (requires OP)
                this.teleportNearPlayer(name, this.autoFollowDistance).then(() => {}).catch(() => {});
            }
        } catch {}

        // Start a lightweight loop to maintain following when players join/leave
        if (this.autoFollowInterval) clearInterval(this.autoFollowInterval);
        this.autoFollowInterval = setInterval(() => {
            if (!this.isReady() || !this.bot) return;
            const target = this.autoFollowTarget;
            if (target) {
                const data = this.bot.players[target];
                if (!data || !data.entity) {
                    // Target lost -> choose a new nearest target
                    const name = this.findNearestPlayerName();
                    if (name) {
                        this.autoFollowTarget = name;
                        try { this.followPlayer(name, this.autoFollowDistance); } catch {}
                    }
                }
            } else {
                // Not following anyone yet -> try to start
                const name = this.findNearestPlayerName();
                if (name) {
                    this.autoFollowTarget = name;
                    try { this.followPlayer(name, this.autoFollowDistance); } catch {}
                }
            }
        }, 3000);

        // React when players join
        this.bot.on('playerJoined', (p) => {
            if (!p || !p.username) return;
            if (!this.autoFollowTarget) {
                try { this.followNearestPlayer(this.autoFollowDistance); } catch {}
            }
        });
    }

    private onSpawn(): void {
        // Auto follow nearest player at spawn and attempt a teleport near them
        this.startAutoFollow();
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

    public getInternalBot() {
        return this.bot;
    }

    public async runCommand(command: string, timeoutMs = 3000): Promise<{ ok: boolean; output: string[] }>{
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const bot = this.bot;
        const output: string[] = [];
        const onMessage = (jsonMsg: any) => {
            try {
                const text = (jsonMsg && typeof jsonMsg.toString === 'function') ? jsonMsg.toString() : String(jsonMsg || '');
                if (text) output.push(text);
            } catch {}
        };

        bot.on('message', onMessage);
        try {
            bot.chat(command.startsWith('/') ? command : `/${command}`);
            await new Promise((resolve) => setTimeout(resolve, timeoutMs));
        } finally {
            bot.removeListener('message', onMessage);
        }

        const lower = output.join('\n').toLowerCase();
        const success = lower.includes('gave') || lower.includes('donne') || lower.includes('a donné');
        const permissionError = lower.includes('permission') || lower.includes("n'avez pas la permission") || lower.includes('no tienes permiso');
        const unknown = lower.includes('unknown') || lower.includes('incomplete') || lower.includes('inconnu');
        const playerMissing = lower.includes('does not exist') || lower.includes('not found') || lower.includes('aucun joueur');

        const ok = success && !permissionError && !unknown && !playerMissing;
        return { ok, output };
    }

    public async giveEmeralds(playerName: string, amount = 10): Promise<boolean> {
        const { ok } = await this.runCommand(`/give ${playerName} minecraft:emerald ${amount}`);
        return ok;
    }

    public async giveItem(
        playerName: string,
        itemId: string,
        count: number,
        enchants?: Array<{ id: string; level: number }>,
        timeoutMs = 4000
    ): Promise<{ ok: boolean; command: string; output: string[] }>{
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }

        const normCount = Math.max(1, Math.min(64, Math.floor(count || 1)));
        let id = (itemId || '').trim().toLowerCase();
        if (!id) throw new Error('Invalid item id');
        if (!id.includes(':')) id = `minecraft:${id}`;

        let nbt = '';
        if (enchants && enchants.length > 0) {
            const parts = enchants
                .filter(e => e && e.id && e.level && e.level > 0)
                .map(e => {
                    let eid = e.id.toLowerCase();
                    if (!eid.includes(':')) eid = `minecraft:${eid}`;
                    const lvl = Math.max(1, Math.min(255, Math.floor(e.level)));
                    return `{id:"${eid}",lvl:${lvl}s}`;
                });
            if (parts.length > 0) {
                nbt = `{Enchantments:[${parts.join(',')}]} `;
            }
        }

        const cmd = `/give ${playerName} ${id} ${normCount} ${nbt}`.trim();
        const res = await this.runCommand(cmd, timeoutMs);
        return { ok: res.ok, command: cmd, output: res.output };
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

        // Find any recipe that produces the item (at least 1 per craft)
        const recipe = this.bot.recipesFor(item.id, null, 1, null)[0];
        if (!recipe) {
            throw new Error(`No recipe found for ${itemName}`);
        }

        const perCraft = (recipe as any).result?.count ?? 1;
        const times = Math.max(1, Math.ceil(count / perCraft));

        await this.bot.craft(recipe, times);
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

    public async removePlanks(count: number): Promise<number> {
        if (!this.isReady() || !this.bot) {
            throw new Error('Bot is not ready');
        }
        if (count <= 0) return 0;

        let remaining = count;
        // Work on a snapshot to avoid re-reading while tossing
        const stacks = this.bot.inventory.items().filter(i => i.name.toLowerCase().includes('planks'));
        for (const it of stacks) {
            if (remaining <= 0) break;
            const remove = Math.min(remaining, it.count || 0);
            if (remove <= 0) continue;
            try {
                // Prefer /clear if we have permission (deletes instead of dropping)
                const id = `minecraft:${it.name}`;
                try {
                    const result = await this.runCommand(`/clear @s ${id} ${remove}`, 1200);
                    if (result.ok) {
                        remaining -= remove;
                        continue;
                    }
                } catch {}
                // Fallback to tossing the items (drops them to the ground)
                await this.bot.toss(it.type, null as any, remove);
                remaining -= remove;
            } catch (e) {
                // If toss fails, skip this stack and continue
                continue;
            }
        }
        return count - remaining;
    }
}

export default MinecraftBot;
