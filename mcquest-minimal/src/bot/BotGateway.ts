import mineflayer, { Bot } from 'mineflayer';
import pathfinderModule from 'mineflayer-pathfinder';
const { pathfinder, goals, Movements } = pathfinderModule as typeof import('mineflayer-pathfinder');

import type { Block } from 'prismarine-block';
import { Vec3 } from 'vec3';

import { CombatSystem, CombatSettings } from './CombatSystem.js';
import { SentinelSystem, SentinelSettings } from './SentinelSystem.js';
import { NavigationService } from '../services/NavigationService.js';

async function importPlugin(name: string): Promise<((bot: Bot) => void) | null> {
  try {
    const mod: any = await import(name);
    const candidate = mod?.plugin ?? mod?.default ?? mod;
    return typeof candidate === 'function' ? candidate : null;
  } catch {
    return null;
  }
}

let toolPlugin: ((bot: Bot) => void) | null = null;
let collectPlugin: ((bot: Bot) => void) | null = null;
let armorPlugin: ((bot: Bot) => void) | null = null;
let pvpPlugin: ((bot: Bot) => void) | null = null;
let autoEatPlugin: ((bot: Bot) => void) | null = null;

const loadPlugins = async (): Promise<void> => {
  if (process.env.FEATURE_TOOL_AUTO_EQUIP === 'true') {
    toolPlugin = await importPlugin('mineflayer-tool');
  }
  if (process.env.FEATURE_COLLECT === 'true') {
    collectPlugin = await importPlugin('mineflayer-collectblock');
  }
  if (process.env.FEATURE_ARMOR_MANAGER === 'true') {
    armorPlugin = await importPlugin('mineflayer-armor-manager');
  }
  if (process.env.FEATURE_PVP === 'true') {
    pvpPlugin = await importPlugin('mineflayer-pvp');
  }
  if (process.env.FEATURE_AUTO_EAT === 'true') {
    // la lib expose souvent default = fn plugin
    autoEatPlugin = await importPlugin('mineflayer-auto-eat');
  }
};

export type BotRuntimeConfig = {
  host: string;
  port: number;
  username: string;
  password?: string;
  version: string;
};

export type BotSnapshot = {
  connected: boolean;
  spawned: boolean;
  username?: string;
  health?: number;
  food?: number;
  position?: { x: number; y: number; z: number };
  gameMode?: string;
  playersOnline?: number;
};

export class BotGateway {
  private bot: Bot | null = null;
  private reconnecting = false;
  private attempts = 0;
  private readonly maxAttempts = 8;
  private reconnectTimer: NodeJS.Timeout | null = null;

  private combatSystem: CombatSystem | null = null;
  private sentinelSystem: SentinelSystem | null = null;
  private navigationService: NavigationService | null = null;

  constructor(private readonly cfg: BotRuntimeConfig) {}

  start(): void { void this.connect(); }

  get botInstance(): Bot | null { return this.bot; }
  getBotInstance(): Bot | null { return this.bot; }
  getNavigationService(): NavigationService | null { return this.navigationService; }

  isReady(): boolean {
    return Boolean(this.bot && this.bot.entity && !(this.bot as any)._client?.ended);
  }

  private async connect(): Promise<void> {
    if (this.reconnecting) return;

    this.reconnecting = true;
    this.attempts += 1;

    try {
      const bot = mineflayer.createBot({
        host: this.cfg.host,
        port: this.cfg.port,
        username: this.cfg.username,
        password: this.cfg.password,
        version: this.cfg.version,
        auth: this.cfg.password ? 'microsoft' : 'offline',
        hideErrors: false,
      });

      await loadPlugins();

      bot.loadPlugin(pathfinder);
      if (toolPlugin)    { console.log('[mcquest] Loading tool plugin');        bot.loadPlugin(toolPlugin); }
      if (collectPlugin) { console.log('[mcquest] Loading collectblock plugin'); bot.loadPlugin(collectPlugin); }
      if (armorPlugin)   { console.log('[mcquest] Loading armor manager plugin'); bot.loadPlugin(armorPlugin); }
      if (pvpPlugin)     { console.log('[mcquest] Loading PVP plugin');          bot.loadPlugin(pvpPlugin); }
      if (autoEatPlugin) { console.log('[mcquest] Loading auto-eat plugin');     bot.loadPlugin(autoEatPlugin); }

      this.attachEventHandlers(bot);
      this.bot = bot;
    } catch (err) {
      console.error('[mcquest] failed to create bot:', this.describeError(err));
      this.scheduleReconnect();
    } finally {
      this.reconnecting = false;
    }
  }

  private attachEventHandlers(bot: Bot): void {
    bot.once('spawn', () => {
      this.attempts = 0;
      console.log('[mcquest] bot spawned, pathfinder ready');

      const movements = new Movements(bot);
      bot.pathfinder.setMovements(movements);

      this.combatSystem = new CombatSystem(bot);
      this.sentinelSystem = new SentinelSystem(bot);
      this.navigationService = new NavigationService(bot);

      if (autoEatPlugin && (bot as any).autoEat) {
        (bot as any).autoEat.options = { priority: 'foodPoints', startAt: 16, bannedFood: [] };
      }

      try { this.combatSystem.enableRetaliationMode(); }
      catch (err) { console.warn('[mcquest] could not enable retaliation mode:', this.describeError(err)); }

      bot.on('playerJoined', (player) => console.log('[mcquest][player] joined:', player.username));
      bot.on('playerLeft', (player) => console.log('[mcquest][player] left:', player.username));

      bot.on('entitySpawn', (entity: any) => {
        if (entity?.type === 'player' && entity.username !== bot.username) {
          console.log('[mcquest][entity] player spawned:', entity.username);
        }
      });

      bot.on('entityGone', (entity: any) => {
        if (entity?.type === 'player' && entity.username !== bot.username) {
          console.log('[mcquest][entity] player gone:', entity.username);
        }
      });
    });

    // chat format errors -> on supprime
    (bot as any)._client.on('error', (err: Error) => {
      if (err?.message?.includes('unknown chat format code')) {
        console.warn('[mcquest] Chat format error suppressed:', err.message);
        return;
      }
      bot.emit('error', err);
    });

    bot.on('error', (err: unknown) => {
      console.error('[mcquest] bot error:', this.describeError(err));
      this.scheduleReconnect();
    });

    bot.on('end', (reason: string) => {
      console.warn('[mcquest] bot disconnected:', reason);
      if (reason !== 'disconnect.quitting') this.scheduleReconnect();
    });

    bot.on('kicked', (reason: string) => {
      console.warn('[mcquest] bot kicked:', reason);
      this.scheduleReconnect();
    });

    bot.on('health', () => {
      if (bot.health <= 0) return;
      if (bot.food < 19 && !(autoEatPlugin && (bot as any).autoEat)) {
        const food = bot.inventory.items().find((item) =>
          item.name.includes('bread') || item.name.includes('apple') ||
          item.name.includes('carrot') || item.name.includes('potato') ||
          item.name.includes('cooked')
        );
        if (food) {
          bot.equip(food, 'hand')
            .then(() => bot.consume().catch(() => undefined))
            .catch(() => undefined);
        }
      }
    });

    bot.on('death', () => {
      console.log('[mcquest] bot died, requesting respawn');
      this.combatSystem = null;
      this.sentinelSystem = null;
      bot.respawn();
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.attempts >= this.maxAttempts) {
      console.error('[mcquest] reached maximum reconnect attempts');
      return;
    }
    const delay = Math.min(30_000, 2000 * Math.max(1, this.attempts));
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.connect();
    }, delay);
  }

  private requireBot(): Bot {
    if (!this.isReady() || !this.bot) throw new Error('bot is not ready');
    return this.bot;
  }

  private describeError(err: unknown): string {
    if (!err) return 'unknown error';
    if (err instanceof Error) return err.message;
    try { return JSON.stringify(err as any); } catch { return String(err); }
  }

  // ----------------- Public API -----------------

  snapshot(): BotSnapshot {
    if (!this.isReady() || !this.bot) return { connected: false, spawned: false };
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

  position(): { x: number; y: number; z: number; yaw: number; pitch: number } {
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

  say(message: string): void {
    const bot = this.requireBot();
    bot.chat(message);
  }

  async moveTo(x: number, y: number, z: number): Promise<string> {
    if (!this.navigationService) throw new Error('Navigation service not initialized');
    await this.navigationService.navigateToPosition(new Vec3(x, y, z));
    return `moved to (${x}, ${y}, ${z})`;
  }

  follow(playerName?: string, distance = 3, continuous = false): string {
    if (!this.navigationService) throw new Error('Navigation service not initialized');

    const bot = this.requireBot();
    const allPlayers = Object.keys(bot.players);

    const requested = (playerName ?? '').trim();
    let targetName: string | null = null;

    if (requested) {
      for (const name of allPlayers) {
        if (name.toLowerCase() === requested.toLowerCase()) {
          if (name === bot.username) throw new Error('Cannot follow the bot itself');
          targetName = name;
          break;
        }
      }
      if (!targetName) {
        const available = allPlayers.filter((n) => n !== bot.username);
        throw new Error(`Player "${requested}" not found. Available: ${available.join(', ') || 'none'}`);
      }
    } else {
      // nearest player
      const myPos = bot.entity?.position;
      if (!myPos) throw new Error('Bot position unavailable');
      let best: string | null = null;
      let bestD = Infinity;
      for (const name of allPlayers) {
        if (name === bot.username) continue;
        const p = bot.players[name];
        if (!p || !p.entity) continue;
        const d = myPos.distanceTo(p.entity.position);
        if (d < bestD) { bestD = d; best = name; }
      }
      if (!best) throw new Error('No players found to follow');
      targetName = best;
      console.log('[follow] Using nearest player:', targetName);
    }

    const followDistance = Number.isFinite(distance) && distance > 0 ? distance : 3;
    this.navigationService.followPlayer(targetName, followDistance, Boolean(continuous));
    return `following ${targetName} at ~${followDistance} blocks (continuous=${Boolean(continuous)})`;
  }

  stop(): string {
    if (!this.navigationService) throw new Error('Navigation service not initialized');
    this.navigationService.stop();
    return 'movement stopped';
  }

  lookAtPlayer(playerName: string): string {
    if (!this.navigationService) throw new Error('Navigation service not initialized');
    this.navigationService.lookAtPlayer(playerName);
    return `looking at ${playerName}`;
  }

  async mine(blockType: string, maxDistance = 32): Promise<string> {
    const bot = this.requireBot();

    const block = bot.findBlock({
      matching: (candidate: any) => candidate?.name === blockType || candidate?.name?.includes(blockType),
      maxDistance,
    });
    if (!block) throw new Error(`No ${blockType} found within ${maxDistance} blocks`);

    if (!bot.canDigBlock(block)) throw new Error(`Cannot dig ${blockType} at this location`);

    // auto-equip outil optimal si plugin dispo
    if ((bot as any).tool && typeof (bot as any).tool.equipForBlock === 'function') {
      try { await (bot as any).tool.equipForBlock(block); } catch (e) { console.warn('[mcquest] tool equip failed:', e); }
    }

    const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
    bot.pathfinder.setGoal(goal);

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('failed to reach block')), 15_000);
      bot.once('goal_reached', () => { clearTimeout(t); resolve(); });
    });

    await bot.dig(block as unknown as Block);
    return `mined ${block.name} at (${block.position.x}, ${block.position.y}, ${block.position.z})`;
  }

  async craft(itemName: string, count = 1): Promise<string> {
    const bot = this.requireBot();
    const item = bot.registry.itemsByName[itemName];
    if (!item) throw new Error(`item "${itemName}" not found in registry`);

    let recipe = bot.recipesFor(item.id, null, count, false)[0];
    let table: any = null;

    if (!recipe) {
      const tableId = bot.registry.blocksByName.crafting_table?.id;
      if (typeof tableId === 'number') {
        table = bot.findBlock({ matching: tableId, maxDistance: 10 }) ?? null;
      }
      recipe = bot.recipesFor(item.id, null, count, true)[0];
      if (!recipe) throw new Error(`no recipe for "${itemName}" (even with crafting table)`);
      if (table) {
        const near = new goals.GoalNear(table.position.x, table.position.y, table.position.z, 1);
        try { await (bot.pathfinder as any).goto(near); } catch { throw new Error('cannot reach crafting table'); }
      }
    }

    // vérifie les ingrédients
    const missing: string[] = [];
    for (const ing of recipe.delta) {
      if (ing.count >= 0) continue;
      const need = -ing.count;
      const have = bot.inventory.count(ing.id, null);
      if (have < need) {
        const ingName = bot.registry.items[ing.id]?.name ?? `#${ing.id}`;
        missing.push(`${need - have}x ${ingName}`);
      }
    }
    if (missing.length > 0) throw new Error(`missing ingredients: ${missing.join(', ')}`);

    await bot.craft(recipe, count, table ?? undefined);
    return `crafted ${count}x ${itemName}`;
  }

  drop(itemName: string, count = 1): string {
    const bot = this.requireBot();
    const item = bot.registry.itemsByName[itemName];
    if (!item) throw new Error(`item "${itemName}" not found`);

    const stack = bot.inventory.findInventoryItem(item.id, null, false);
    if (!stack) throw new Error(`you do not have "${itemName}"`);

    const qty = Math.min(count, stack.count);
    bot.toss(stack.type, null, qty);
    return `dropped ${qty}x ${itemName}`;
  }

  inventory(): Array<{ name: string; displayName: string; count: number; slot: number }> {
    const bot = this.requireBot();
    return bot.inventory.items().map((item) => ({
      name: item.name,
      displayName: item.displayName,
      count: item.count,
      slot: item.slot,
    }));
  }

  // -------- Combat --------
  enableCombatMode(settings?: Partial<CombatSettings>): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.enableCombatMode(settings);
  }
  disableCombatMode(): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.disableCombatMode();
  }
  enableAggressiveMode(targetPlayer?: string): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.enableAggressiveMode(targetPlayer);
  }
  enableRetaliationMode(): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.enableRetaliationMode();
  }
  attackPlayer(playerName: string): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.attackPlayer(playerName);
  }
  getCombatStatus():
    | ReturnType<CombatSystem['getCombatStatus']>
    | { active: false; mode: 'disabled'; currentTarget: null; settings: null; recentAttackers: any[] } {
    if (!this.combatSystem) {
      return { active: false, mode: 'disabled', currentTarget: null, settings: null, recentAttackers: [] };
    }
    return this.combatSystem.getCombatStatus();
  }
  updateCombatSettings(settings: Partial<CombatSettings>): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.updateSettings(settings);
  }
  clearRecentAttackers(): string {
    if (!this.combatSystem) throw new Error('Combat system not initialized');
    return this.combatSystem.clearRecentAttackers();
  }

  // -------- Sentinel --------
  enableSentinel(protectedPlayer: string, settings?: Partial<SentinelSettings>): string {
    if (!this.sentinelSystem) throw new Error('Sentinel system not initialized');
    return this.sentinelSystem.enableSentinel(protectedPlayer, settings);
  }
  disableSentinel(): string {
    if (!this.sentinelSystem) throw new Error('Sentinel system not initialized');
    return this.sentinelSystem.disableSentinel();
  }
  setSentinelZoneDefense(center: { x: number; y: number; z: number }, radius: number): string {
    if (!this.sentinelSystem) throw new Error('Sentinel system not initialized');
    return this.sentinelSystem.setZoneDefense(center, radius);
  }
  getSentinelStatus(): ReturnType<SentinelSystem['getSentinelStatus']> | { active: false; protectedPlayer: null; zoneCenter: null; zoneRadius: 0; threats: 0; settings: null } {
    if (!this.sentinelSystem) {
      return { active: false, protectedPlayer: null, zoneCenter: null, zoneRadius: 0, threats: 0, settings: null };
    }
    return this.sentinelSystem.getSentinelStatus();
  }
  updateSentinelSettings(settings: Partial<SentinelSettings>): string {
    if (!this.sentinelSystem) throw new Error('Sentinel system not initialized');
    return this.sentinelSystem.updateSettings(settings);
  }

  getSystemStatus(): Record<string, unknown> {
    const basic = this.snapshot();
    const combat = this.getCombatStatus();
    return {
      ...basic,
      combat,
      systems: { combat: !!this.combatSystem, sentinel: !!this.sentinelSystem },
      plugins: {
        tool: !!toolPlugin,
        collect: !!collectPlugin,
        armor: !!armorPlugin,
        pvp: !!pvpPlugin,
        autoEat: !!autoEatPlugin
      }
    };
  }
}
