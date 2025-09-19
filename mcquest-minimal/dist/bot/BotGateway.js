// @ts-nocheck
import mineflayer from 'mineflayer';
import pathfinderModule from 'mineflayer-pathfinder';
const { pathfinder, goals, Movements } = pathfinderModule;
import { Vec3 } from 'vec3';
import { CombatSystem } from './CombatSystem.js';
import { SentinelSystem } from './SentinelSystem.js';
import { NavigationService } from '../services/NavigationService.js';
// Plugin imports with feature flag support
let toolPlugin = null;
let collectPlugin = null;
let armorPlugin = null;
let pvpPlugin = null;
let autoEatPlugin = null;
// Load plugins dynamically based on feature flags
const loadPlugins = async () => {
    if (process.env.FEATURE_TOOL_AUTO_EQUIP === 'true') {
        toolPlugin = (await import('mineflayer-tool')).default || (await import('mineflayer-tool'));
    }
    if (process.env.FEATURE_COLLECT === 'true') {
        collectPlugin = (await import('mineflayer-collectblock')).default || (await import('mineflayer-collectblock'));
    }
    if (process.env.FEATURE_ARMOR_MANAGER === 'true') {
        armorPlugin = (await import('mineflayer-armor-manager')).default || (await import('mineflayer-armor-manager'));
    }
    if (process.env.FEATURE_PVP === 'true') {
        pvpPlugin = (await import('mineflayer-pvp')).default || (await import('mineflayer-pvp'));
    }
    if (process.env.FEATURE_AUTO_EAT === 'true') {
        autoEatPlugin = await import('mineflayer-auto-eat');
    }
};
export class BotGateway {
    constructor(cfg) {
        this.cfg = cfg;
        this.bot = null;
        this.reconnecting = false;
        this.attempts = 0;
        this.maxAttempts = 8;
        this.combatSystem = null;
        this.sentinelSystem = null;
        this.navigationService = null;
    }
    start() {
        this.connect();
    }
    get botInstance() {
        return this.bot;
    }
    getBotInstance() {
        return this.bot;
    }
    getNavigationService() {
        return this.navigationService;
    }
    isReady() {
        return Boolean(this.bot && this.bot.entity && !this.bot._client.ended);
    }
    async connect() {
        if (this.reconnecting) {
            return;
        }
        this.reconnecting = true;
        this.attempts += 1;
        console.log(`[mcquest] connecting bot (attempt ${this.attempts}) to ${this.cfg.host}:${this.cfg.port}`);
        const bot = mineflayer.createBot({
            host: this.cfg.host,
            port: this.cfg.port,
            username: this.cfg.username,
            password: this.cfg.password,
            version: this.cfg.version,
            auth: this.cfg.password ? 'microsoft' : 'offline',
            hideErrors: false,
        });
        // Load plugins dynamically first
        await loadPlugins();
        // Load core pathfinder plugin
        bot.loadPlugin(pathfinder);
        // Load optional plugins based on feature flags
        if (toolPlugin) {
            console.log('[mcquest] Loading tool plugin');
            bot.loadPlugin(toolPlugin.plugin || toolPlugin);
        }
        if (collectPlugin) {
            console.log('[mcquest] Loading collectblock plugin');
            bot.loadPlugin(collectPlugin.plugin || collectPlugin);
        }
        if (armorPlugin) {
            console.log('[mcquest] Loading armor manager plugin');
            bot.loadPlugin(armorPlugin.default || armorPlugin);
        }
        if (pvpPlugin) {
            console.log('[mcquest] Loading PVP plugin');
            bot.loadPlugin(pvpPlugin.plugin || pvpPlugin);
        }
        if (autoEatPlugin) {
            console.log('[mcquest] Loading auto-eat plugin');
            bot.loadPlugin(autoEatPlugin);
        }
        this.attachEventHandlers(bot);
        this.bot = bot;
        this.reconnecting = false;
    }
    attachEventHandlers(bot) {
        bot.once('spawn', () => {
            this.attempts = 0;
            console.log('[mcquest] bot spawned, pathfinder ready');
            const movements = new Movements(bot);
            bot.pathfinder.setMovements(movements);
            // Initialize remaining systems
            this.combatSystem = new CombatSystem(bot);
            this.sentinelSystem = new SentinelSystem(bot);
            this.navigationService = new NavigationService(bot);
            // Configure auto-eat plugin if enabled
            if (autoEatPlugin && bot.autoEat) {
                bot.autoEat.options = {
                    priority: 'foodPoints',
                    startAt: 16,
                    bannedFood: []
                };
            }
            // Enable retaliation mode by default so bot defends itself
            this.combatSystem.enableRetaliationMode();
            console.log('[mcquest] All systems initialized including sentinel system');
            // DEBUGGING: Listen for player events
            bot.on('playerJoined', (player) => {
                console.log('🟢 [PLAYER EVENT] Player joined:', player.username);
                console.log('🟢 [PLAYER EVENT] Total players now:', Object.keys(bot.players).length);
            });
            bot.on('playerLeft', (player) => {
                console.log('🔴 [PLAYER EVENT] Player left:', player.username);
                console.log('🔴 [PLAYER EVENT] Total players now:', Object.keys(bot.players).length);
            });
            bot.on('entitySpawn', (entity) => {
                if (entity.type === 'player' && entity.username !== bot.username) {
                    console.log('👤 [ENTITY EVENT] Player entity spawned:', entity.username);
                }
            });
            bot.on('entityGone', (entity) => {
                if (entity.type === 'player' && entity.username !== bot.username) {
                    console.log('👻 [ENTITY EVENT] Player entity gone:', entity.username);
                }
            });
            // Periodic player check
            setInterval(() => {
                const playerCount = Object.keys(bot.players).length;
                const entityPlayerCount = Object.values(bot.entities).filter(e => e && e.type === 'player').length;
                console.log(`🔍 [PERIODIC] Players: ${playerCount}, Player entities: ${entityPlayerCount}`);
                if (playerCount > 0) {
                    console.log(`🔍 [PERIODIC] Player list:`, Object.keys(bot.players));
                }
            }, 10000); // Every 10 seconds
        });
        // Handle chat parsing errors that crash the bot
        bot._client.on('error', (err) => {
            if (err.message && err.message.includes('unknown chat format code')) {
                console.warn('[mcquest] Chat format error suppressed:', err.message);
                return; // Don't crash, just ignore this error
            }
            // Re-emit other errors normally
            bot.emit('error', err);
        });
        bot.on('error', (err) => {
            console.error('[mcquest] bot error:', this.describeError(err));
            this.scheduleReconnect();
        });
        bot.on('end', (reason) => {
            console.warn('[mcquest] bot disconnected:', reason);
            if (reason !== 'disconnect.quitting') {
                this.scheduleReconnect();
            }
        });
        bot.on('kicked', (reason) => {
            console.warn('[mcquest] bot kicked:', reason);
            this.scheduleReconnect();
        });
        bot.on('health', () => {
            if (bot.health <= 0) {
                console.warn('[mcquest] bot has zero health');
                return;
            }
            if (bot.food < 19 && !(autoEatPlugin && bot.autoEat)) {
                const food = bot.inventory.items().find((item) => (item.name.includes('bread') ||
                    item.name.includes('apple') ||
                    item.name.includes('carrot') ||
                    item.name.includes('potato') ||
                    item.name.includes('cooked')));
                if (food) {
                    bot.equip(food, 'hand')
                        .then(() => bot.consume().catch(() => undefined))
                        .catch(() => undefined);
                }
            }
        });
        bot.on('death', () => {
            console.log('[mcquest] bot died, requesting respawn');
            // Clean up systems before respawning
            this.combatSystem = null;
            this.sentinelSystem = null;
            bot.respawn();
        });
    }
    scheduleReconnect() {
        if (this.attempts >= this.maxAttempts) {
            console.error('[mcquest] reached maximum reconnect attempts');
            return;
        }
        if (this.reconnecting) {
            return;
        }
        this.reconnecting = true;
        const delay = Math.min(30000, 2000 * Math.max(1, this.attempts));
        console.log(`[mcquest] reconnecting in ${delay}ms`);
        setTimeout(async () => {
            this.reconnecting = false;
            await this.connect();
        }, delay);
    }
    requireBot() {
        if (!this.isReady() || !this.bot) {
            throw new Error('bot is not connected');
        }
        return this.bot;
    }
    describeError(err) {
        if (err && typeof err === 'object' && 'errors' in err && Array.isArray(err.errors)) {
            const errors = err.errors;
            return errors.map((cause) => this.describeError(cause)).join('; ');
        }
        if (err instanceof Error) {
            return err.message || err.toString();
        }
        if (err === null) {
            return 'null';
        }
        if (typeof err === 'object') {
            try {
                return JSON.stringify(err);
            }
            catch {
                return String(err);
            }
        }
        return String(err);
    }
    snapshot() {
        if (!this.isReady() || !this.bot) {
            return { connected: false, spawned: false };
        }
        const entity = this.bot.entity;
        return {
            connected: true,
            spawned: true,
            username: this.bot.username,
            health: this.bot.health,
            food: this.bot.food,
            position: { x: entity.position.x, y: entity.position.y, z: entity.position.z },
            gameMode: this.bot.game.gameMode,
            playersOnline: Object.keys(this.bot.players).length,
        };
    }
    position() {
        const bot = this.requireBot();
        const { position, yaw, pitch } = bot.entity;
        return {
            x: Math.round(position.x * 100) / 100,
            y: Math.round(position.y * 100) / 100,
            z: Math.round(position.z * 100) / 100,
            yaw: Math.round(yaw * 100) / 100,
            pitch: Math.round(pitch * 100) / 100,
        };
    }
    say(message) {
        const bot = this.requireBot();
        bot.chat(message);
    }
    async moveTo(x, y, z) {
        if (!this.navigationService) {
            throw new Error('Navigation service not initialized');
        }
        const position = new Vec3(x, y, z);
        await this.navigationService.navigateToPosition(position);
        return `arrived at (${x}, ${y}, ${z})`;
    }
    follow(playerName, distance = 3, continuous = false) {
        if (!this.navigationService) {
            throw new Error('Navigation service not initialized');
        }
        const bot = this.requireBot();
        const allPlayers = Object.keys(bot.players);
        console.log('[follow] All players in bot.players:', allPlayers);
        let targetName = playerName?.trim();
        // If no playerName specified, find first available player
        if (!targetName) {
            const availablePlayers = allPlayers.filter(name => name !== bot.username);
            if (availablePlayers.length === 0) {
                throw new Error('No other players found to follow');
            }
            targetName = availablePlayers[0];
            console.log('[follow] No target specified, using first available player:', targetName);
        }
        // Find target player (case-insensitive)
        for (const [name, player] of Object.entries(bot.players)) {
            if (name.toLowerCase() === targetName.toLowerCase() && name !== bot.username) {
                targetName = name;
                break;
            }
        }
        if (!bot.players[targetName] || !bot.players[targetName].entity) {
            const availablePlayers = allPlayers.filter(name => name !== bot.username);
            throw new Error(`I don't see player '${targetName}'! Available players: ${availablePlayers.join(', ')}`);
        }
        console.log(`[follow] Following ${targetName} at distance ${distance}`);
        this.navigationService.followPlayer(targetName, distance, continuous);
        return `Following ${targetName} at ${distance} blocks distance`;
    }
    stop() {
        if (!this.navigationService) {
            throw new Error('Navigation service not initialized');
        }
        this.navigationService.stop();
        return 'movement stopped';
    }
    lookAtPlayer(playerName) {
        if (!this.navigationService) {
            throw new Error('Navigation service not initialized');
        }
        this.navigationService.lookAtPlayer(playerName);
        return `looking at ${playerName}`;
    }
    async mine(blockType, maxDistance = 32) {
        const bot = this.requireBot();
        const block = bot.findBlock({
            matching: (candidate) => candidate.name === blockType || candidate.name.includes(blockType),
            maxDistance,
        });
        if (!block) {
            throw new Error(`no ${blockType} within ${maxDistance} blocks`);
        }
        if (!bot.canDigBlock(block)) {
            throw new Error(`cannot mine ${blockType} at that position`);
        }
        // Auto-equip proper tool if tool plugin is enabled
        if (toolPlugin && bot.tool) {
            try {
                await bot.tool.equipForBlock(block);
            }
            catch (err) {
                console.warn('[mcquest] Could not auto-equip tool:', err);
            }
        }
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        bot.pathfinder.setGoal(goal);
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('failed to reach block')), 15000);
            bot.once('goal_reached', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
        await bot.dig(block);
        return `mined ${block.name} at (${block.position.x}, ${block.position.y}, ${block.position.z})`;
    }
    async craft(itemName, count = 1) {
        const bot = this.requireBot();
        const item = bot.registry.itemsByName[itemName];
        if (!item) {
            throw new Error(`item ${itemName} is unknown`);
        }
        let recipe = bot.recipesFor(item.id, null, count, false)[0];
        let table = null;
        if (!recipe) {
            const tableId = bot.registry.blocksByName.crafting_table?.id;
            if (typeof tableId === 'number') {
                table = bot.findBlock({ matching: tableId, maxDistance: 10 }) ?? null;
            }
            recipe = bot.recipesFor(item.id, null, count, true)[0];
            if (!recipe) {
                throw new Error(`no recipe for ${itemName}`);
            }
            if (table) {
                const nearGoal = new goals.GoalNear(table.position.x, table.position.y, table.position.z, 1);
                try {
                    await bot.pathfinder.goto(nearGoal);
                }
                catch (err) {
                    throw new Error('cannot reach crafting table');
                }
            }
        }
        const missing = [];
        for (const ing of recipe.delta) {
            if (ing.count >= 0) {
                continue;
            }
            const required = -ing.count;
            const owned = bot.inventory.count(ing.id, null);
            if (owned < required) {
                const name = bot.registry.items[ing.id]?.name ?? `item-${ing.id}`;
                missing.push(`${required - owned}x ${name}`);
            }
        }
        if (missing.length > 0) {
            throw new Error(`missing ingredients: ${missing.join(', ')}`);
        }
        await bot.craft(recipe, count, table ?? undefined);
        return `crafted ${count}x ${itemName}`;
    }
    drop(itemName, count = 1) {
        const bot = this.requireBot();
        const item = bot.registry.itemsByName[itemName];
        if (!item) {
            throw new Error(`item ${itemName} is unknown`);
        }
        const stack = bot.inventory.findInventoryItem(item.id, null, false);
        if (!stack) {
            throw new Error(`no ${itemName} in inventory`);
        }
        const quantity = Math.min(count, stack.count);
        bot.toss(stack.type, null, quantity);
        return `dropped ${quantity}x ${itemName}`;
    }
    inventory() {
        const bot = this.requireBot();
        return bot.inventory.items().map((item) => ({
            name: item.name,
            displayName: item.displayName,
            count: item.count,
            slot: item.slot,
        }));
    }
    // Combat System Methods
    enableCombatMode(settings) {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.enableCombatMode(settings);
    }
    disableCombatMode() {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.disableCombatMode();
    }
    enableAggressiveMode(targetPlayer) {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.enableAggressiveMode(targetPlayer);
    }
    enableRetaliationMode() {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.enableRetaliationMode();
    }
    attackPlayer(playerName) {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.attackPlayer(playerName);
    }
    getCombatStatus() {
        if (!this.combatSystem) {
            return {
                active: false,
                mode: 'disabled',
                currentTarget: null,
                settings: null,
                recentAttackers: []
            };
        }
        return this.combatSystem.getCombatStatus();
    }
    updateCombatSettings(settings) {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.updateSettings(settings);
    }
    clearRecentAttackers() {
        if (!this.combatSystem) {
            throw new Error('Combat system not initialized');
        }
        return this.combatSystem.clearRecentAttackers();
    }
    // Get basic status
    getSystemStatus() {
        const basicStatus = this.snapshot();
        const combatStatus = this.getCombatStatus();
        return {
            ...basicStatus,
            combat: combatStatus,
            systems: {
                combat: !!this.combatSystem,
                sentinel: !!this.sentinelSystem
            },
            plugins: {
                tool: !!toolPlugin,
                collect: !!collectPlugin,
                armor: !!armorPlugin,
                pvp: !!pvpPlugin,
                autoEat: !!autoEatPlugin
            }
        };
    }
    // Sentinel System Methods
    enableSentinel(protectedPlayer, settings) {
        if (!this.sentinelSystem) {
            throw new Error('Sentinel system not initialized');
        }
        return this.sentinelSystem.enableSentinel(protectedPlayer, settings);
    }
    disableSentinel() {
        if (!this.sentinelSystem) {
            throw new Error('Sentinel system not initialized');
        }
        return this.sentinelSystem.disableSentinel();
    }
    setSentinelZoneDefense(center, radius) {
        if (!this.sentinelSystem) {
            throw new Error('Sentinel system not initialized');
        }
        return this.sentinelSystem.setZoneDefense(center, radius);
    }
    getSentinelStatus() {
        if (!this.sentinelSystem) {
            return {
                active: false,
                protectedPlayer: null,
                zoneCenter: null,
                zoneRadius: 0,
                threats: 0,
                settings: null
            };
        }
        return this.sentinelSystem.getSentinelStatus();
    }
    updateSentinelSettings(settings) {
        if (!this.sentinelSystem) {
            throw new Error('Sentinel system not initialized');
        }
        return this.sentinelSystem.updateSettings(settings);
    }
}
