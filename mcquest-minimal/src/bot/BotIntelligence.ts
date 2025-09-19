import { Bot } from 'mineflayer';
import pathfinderModule from 'mineflayer-pathfinder';
const { goals } = pathfinderModule as unknown as typeof import('mineflayer-pathfinder');
import { Block } from 'prismarine-block';

export interface EnvironmentAnalysis {
  nearbyBlocks: Array<{ name: string; position: { x: number; y: number; z: number }; distance: number }>;
  nearbyPlayers: Array<{ name: string; position: { x: number; y: number; z: number }; distance: number }>;
  dangerousBlocks: Array<{ name: string; position: { x: number; y: number; z: number }; reason: string }>;
  resourceBlocks: Array<{ name: string; position: { x: number; y: number; z: number }; rarity: number }>;
  safeSpots: Array<{ position: { x: number; y: number; z: number }; reason: string }>;
}

export interface ActionContext {
  currentTask?: string;
  inventory: Array<{ name: string; count: number }>;
  health: number;
  food: number;
  timeOfDay: number;
  weather: string;
  nearbyThreats: string[];
  availableResources: string[];
}

export interface DecisionResult {
  action: string;
  priority: number;
  reason: string;
  parameters?: any;
}

export class BotIntelligence {
  private bot: Bot;
  private currentGoals: string[] = [];
  private memoryBank: Map<string, any> = new Map();
  private lastEnvironmentScan: number = 0;
  private environmentCache: EnvironmentAnalysis | null = null;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async analyzeEnvironment(radius: number = 32): Promise<EnvironmentAnalysis> {
    const now = Date.now();
    if (this.environmentCache && (now - this.lastEnvironmentScan) < 5000) {
      return this.environmentCache;
    }

    const botPos = this.bot.entity.position;
    const nearbyBlocks: Array<{ name: string; position: { x: number; y: number; z: number }; distance: number }> = [];
    const dangerousBlocks: Array<{ name: string; position: { x: number; y: number; z: number }; reason: string }> = [];
    const resourceBlocks: Array<{ name: string; position: { x: number; y: number; z: number }; rarity: number }> = [];
    const safeSpots: Array<{ position: { x: number; y: number; z: number }; reason: string }> = [];

    // Scan for blocks around the bot
    for (let x = -radius; x <= radius; x++) {
      for (let y = -radius; y <= radius; y++) {
        for (let z = -radius; z <= radius; z++) {
          const pos = botPos.offset(x, y, z);
          const block = this.bot.blockAt(pos);

          if (!block || block.type === 0) continue;

          const distance = Math.sqrt(x * x + y * y + z * z);
          if (distance > radius) continue;

          const blockInfo = {
            name: block.name,
            position: { x: pos.x, y: pos.y, z: pos.z },
            distance: Math.round(distance * 100) / 100
          };

          nearbyBlocks.push(blockInfo);

          // Categorize blocks
          if (this.isDangerousBlock(block.name)) {
            dangerousBlocks.push({
              ...blockInfo,
              reason: this.getDangerReason(block.name)
            });
          }

          if (this.isResourceBlock(block.name)) {
            resourceBlocks.push({
              ...blockInfo,
              rarity: this.getResourceRarity(block.name)
            });
          }

          if (this.isSafeBlock(block.name) && y >= 0) {
            safeSpots.push({
              position: blockInfo.position,
              reason: 'Safe shelter block'
            });
          }
        }
      }
    }

    // Analyze nearby players
    const nearbyPlayers = Object.values(this.bot.players)
      .filter(player => player && player.entity && player.username !== this.bot.username)
      .map(player => ({
        name: player.username,
        position: {
          x: player.entity!.position.x,
          y: player.entity!.position.y,
          z: player.entity!.position.z
        },
        distance: Math.round(botPos.distanceTo(player.entity!.position) * 100) / 100
      }))
      .filter(player => player.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

    this.environmentCache = {
      nearbyBlocks: nearbyBlocks.sort((a, b) => a.distance - b.distance).slice(0, 50),
      nearbyPlayers,
      dangerousBlocks,
      resourceBlocks: resourceBlocks.sort((a, b) => b.rarity - a.rarity),
      safeSpots
    };

    this.lastEnvironmentScan = now;
    return this.environmentCache;
  }

  async makeDecision(context: ActionContext): Promise<DecisionResult> {
    const decisions: DecisionResult[] = [];

    // Survival priorities
    if (context.health <= 5) {
      decisions.push({
        action: 'seek_safety',
        priority: 100,
        reason: 'Critical health - need immediate safety',
        parameters: { urgency: 'critical' }
      });
    }

    if (context.food <= 5) {
      decisions.push({
        action: 'find_food',
        priority: 90,
        reason: 'Low food - need to eat soon',
        parameters: { searchRadius: 32 }
      });
    }

    // Environmental threats
    if (context.nearbyThreats.length > 0) {
      decisions.push({
        action: 'avoid_threats',
        priority: 80,
        reason: `Detected ${context.nearbyThreats.length} threats nearby`,
        parameters: { threats: context.nearbyThreats }
      });
    }

    // Resource gathering
    if (context.availableResources.length > 0) {
      const rareMaterials = context.availableResources.filter(r =>
        ['diamond', 'emerald', 'gold', 'iron'].some(rare => r.includes(rare))
      );

      if (rareMaterials.length > 0) {
        decisions.push({
          action: 'gather_resources',
          priority: 60,
          reason: `Found valuable resources: ${rareMaterials.join(', ')}`,
          parameters: { resources: rareMaterials, priority: 'high' }
        });
      }
    }

    // Social interaction
    const environment = await this.analyzeEnvironment();
    if (environment.nearbyPlayers.length > 0) {
      decisions.push({
        action: 'social_interaction',
        priority: 30,
        reason: `${environment.nearbyPlayers.length} players nearby`,
        parameters: { players: environment.nearbyPlayers }
      });
    }

    // Return highest priority decision
    decisions.sort((a, b) => b.priority - a.priority);
    return decisions[0] || {
      action: 'explore',
      priority: 10,
      reason: 'No specific goals - exploring the world',
      parameters: { mode: 'casual' }
    };
  }

  async executeIntelligentAction(action: string, parameters: any = {}): Promise<string> {
    switch (action) {
      case 'seek_safety':
        return this.seekSafety(parameters);

      case 'find_food':
        return this.findAndEatFood(parameters);

      case 'gather_resources':
        return this.gatherResources(parameters);

      case 'avoid_threats':
        return this.avoidThreats(parameters);

      case 'social_interaction':
        return this.socialInteraction(parameters);

      case 'explore':
        return this.exploreIntelligently(parameters);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  private async seekSafety(params: any): Promise<string> {
    const environment = await this.analyzeEnvironment();

    if (environment.safeSpots.length > 0) {
      const safest = environment.safeSpots[0];
      const goal = new goals.GoalBlock(safest.position.x, safest.position.y, safest.position.z);
      this.bot.pathfinder.setGoal(goal);
      return `Moving to safe location at (${safest.position.x}, ${safest.position.y}, ${safest.position.z})`;
    }

    // Create safety by going up if no safe spots found
    const pos = this.bot.entity.position;
    const goal = new goals.GoalBlock(pos.x, pos.y + 10, pos.z);
    this.bot.pathfinder.setGoal(goal);
    return 'No safe spots found - gaining altitude for safety';
  }

  private async findAndEatFood(params: any): Promise<string> {
    const food = this.bot.inventory.items().find(item =>
      ['bread', 'apple', 'carrot', 'potato', 'cooked', 'steak', 'pork'].some(f => item.name.includes(f))
    );

    if (food) {
      try {
        await this.bot.equip(food, 'hand');
        await this.bot.consume();
        return `Consumed ${food.displayName}`;
      } catch (error) {
        return `Failed to eat ${food.displayName}: ${error}`;
      }
    }

    // Look for food in environment
    const foodBlocks = ['wheat', 'carrots', 'potatoes', 'beetroots'].map(crop =>
      this.bot.findBlock({
        matching: block => block.name.includes(crop),
        maxDistance: params.searchRadius || 32
      })
    ).filter(Boolean);

    if (foodBlocks.length > 0) {
      const closest = foodBlocks[0]!;
      const goal = new goals.GoalBlock(closest.position.x, closest.position.y, closest.position.z);
      this.bot.pathfinder.setGoal(goal);
      return `Moving to harvest ${closest.name}`;
    }

    return 'No food available - continuing current activities';
  }

  private async gatherResources(params: any): Promise<string> {
    const resources = params.resources || [];

    for (const resourceName of resources) {
      const block = this.bot.findBlock({
        matching: block => block.name.includes(resourceName),
        maxDistance: 32
      });

      if (block && this.bot.canDigBlock(block)) {
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        this.bot.pathfinder.setGoal(goal);

        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Mining timeout')), 30000);

          this.bot.once('goal_reached', async () => {
            clearTimeout(timeout);
            try {
              await this.bot.dig(block as Block);
              resolve(`Successfully mined ${block.name}`);
            } catch (error) {
              reject(error);
            }
          });
        });
      }
    }

    return 'No accessible resources found';
  }

  private async avoidThreats(params: any): Promise<string> {
    const threats = params.threats || [];
    const pos = this.bot.entity.position;

    // Calculate escape direction (opposite to threats)
    let escapeX = pos.x;
    let escapeZ = pos.z;

    threats.forEach((threat: string) => {
      // Simple threat avoidance logic
      escapeX += Math.random() * 20 - 10;
      escapeZ += Math.random() * 20 - 10;
    });

    const goal = new goals.GoalBlock(Math.floor(escapeX), pos.y, Math.floor(escapeZ));
    this.bot.pathfinder.setGoal(goal);

    return `Avoiding ${threats.length} threats by moving to safer area`;
  }

  private async socialInteraction(params: any): Promise<string> {
    const players = params.players || [];

    if (players.length > 0) {
      const nearest = players[0];

      // Simple greeting logic
      const greetings = [
        `Hello ${nearest.name}!`,
        `Hi there, ${nearest.name}!`,
        `Greetings, ${nearest.name}!`,
        `Hey ${nearest.name}, how are you?`
      ];

      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      this.bot.chat(greeting);

      return `Greeted ${nearest.name}`;
    }

    return 'No players to interact with';
  }

  private async exploreIntelligently(params: any): Promise<string> {
    const environment = await this.analyzeEnvironment();
    const pos = this.bot.entity.position;

    // Choose exploration direction based on interesting features
    let targetX = pos.x;
    let targetZ = pos.z;

    if (environment.resourceBlocks.length > 0) {
      const interesting = environment.resourceBlocks[0];
      targetX = interesting.position.x;
      targetZ = interesting.position.z;
    } else {
      // Random exploration
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 50;
      targetX += Math.cos(angle) * distance;
      targetZ += Math.sin(angle) * distance;
    }

    const goal = new goals.GoalBlock(Math.floor(targetX), pos.y, Math.floor(targetZ));
    this.bot.pathfinder.setGoal(goal);

    return `Exploring towards (${Math.floor(targetX)}, ${pos.y}, ${Math.floor(targetZ)})`;
  }

  private isDangerousBlock(blockName: string): boolean {
    const dangerous = ['lava', 'fire', 'magma', 'cactus', 'sweet_berry_bush', 'wither_rose'];
    return dangerous.some(danger => blockName.includes(danger));
  }

  private getDangerReason(blockName: string): string {
    if (blockName.includes('lava')) return 'Lava - causes fire damage';
    if (blockName.includes('fire')) return 'Fire - causes burn damage';
    if (blockName.includes('cactus')) return 'Cactus - causes contact damage';
    if (blockName.includes('magma')) return 'Magma block - causes damage when walked on';
    return 'Unknown danger';
  }

  private isResourceBlock(blockName: string): boolean {
    const resources = ['coal', 'iron', 'gold', 'diamond', 'emerald', 'lapis', 'redstone', 'copper'];
    return resources.some(resource => blockName.includes(resource));
  }

  private getResourceRarity(blockName: string): number {
    if (blockName.includes('diamond')) return 10;
    if (blockName.includes('emerald')) return 9;
    if (blockName.includes('gold')) return 7;
    if (blockName.includes('lapis')) return 6;
    if (blockName.includes('iron')) return 5;
    if (blockName.includes('copper')) return 4;
    if (blockName.includes('redstone')) return 4;
    if (blockName.includes('coal')) return 2;
    return 1;
  }

  private isSafeBlock(blockName: string): boolean {
    const safe = ['cobblestone', 'stone', 'planks', 'bricks', 'wool'];
    return safe.some(s => blockName.includes(s));
  }

  public addGoal(goal: string): void {
    this.currentGoals.push(goal);
  }

  public removeGoal(goal: string): void {
    this.currentGoals = this.currentGoals.filter(g => g !== goal);
  }

  public getGoals(): string[] {
    return [...this.currentGoals];
  }

  public remember(key: string, value: any): void {
    this.memoryBank.set(key, value);
  }

  public recall(key: string): any {
    return this.memoryBank.get(key);
  }

  public clearMemory(): void {
    this.memoryBank.clear();
  }
}