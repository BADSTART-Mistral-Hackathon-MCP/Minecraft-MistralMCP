import type { Bot } from 'mineflayer';
import { Vec3 } from 'vec3';
import pathfinderModule from 'mineflayer-pathfinder';
const { goals } = pathfinderModule as typeof import('mineflayer-pathfinder');

export interface NavigationTarget {
  type: 'position' | 'player' | 'entity' | 'block';
  position?: Vec3;
  playerName?: string;
  entityId?: number;
  blockType?: string;
}

export interface NavigationOptions {
  timeout?: number;
  range?: number;
  sprint?: boolean;
  avoidWater?: boolean;
  avoidLava?: boolean;
  allowDigging?: boolean;
  allowPlacing?: boolean;
  returnOnFailure?: boolean;
  dynamic?: boolean; // re-path continu (2e arg de setGoal)
}

export interface PhysicsState {
  velocity: Vec3;
  onGround: boolean;
  inWater: boolean;
  inLava: boolean;
  isClimbing: boolean;
  isFlying: boolean;
}

export class NavigationService {
  private currentTarget: NavigationTarget | null = null;
  private isNavigating = false;
  private followingPlayer: string | null = null;
  private followDistance = 3;
  private followContinuous = false;
  private navigationInterval: NodeJS.Timeout | null = null;

  constructor(private readonly bot: Bot) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.bot.on('goal_reached', () => {
      console.log('[navigation] Goal reached');
      this.isNavigating = false;
      this.currentTarget = null;
    });

    this.bot.on('path_update', (result: any) => {
      if (result?.status === 'noPath') {
        console.log('[navigation] No path found to target');
        this.isNavigating = false;
      }
    });
  }

  async navigateToPosition(position: Vec3, options: NavigationOptions = {}): Promise<void> {
    if (!(this.bot as any).pathfinder) throw new Error('Pathfinder plugin not loaded');

    this.currentTarget = { type: 'position', position };
    this.isNavigating = true;

    const timeoutMs = options.timeout ?? 30_000;
    const dynamic = Boolean(options.dynamic); // 2e arg = re-path continu

    const goal = new goals.GoalBlock(position.x, position.y, position.z);
    (this.bot as any).pathfinder.setGoal(goal, dynamic);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.isNavigating = false;
        reject(new Error('Navigation timeout'));
      }, timeoutMs);

      const onGoalReached = () => {
        clearTimeout(timeout);
        this.bot.removeListener('goal_reached', onGoalReached);
        this.bot.removeListener('path_update', onPathUpdate);
        this.isNavigating = false;
        resolve();
      };

      const onPathUpdate = (r: any) => {
        if (r?.status === 'noPath') {
          clearTimeout(timeout);
          this.bot.removeListener('goal_reached', onGoalReached);
          this.bot.removeListener('path_update', onPathUpdate);
          this.isNavigating = false;
          reject(new Error('No path found to target'));
        }
      };

      this.bot.on('goal_reached', onGoalReached);
      this.bot.on('path_update', onPathUpdate);
    });
  }

  async navigateToPlayer(playerName: string, distance = 3, options: NavigationOptions = {}): Promise<void> {
    if (!(this.bot as any).pathfinder) throw new Error('Pathfinder plugin not loaded');
    const player = this.bot.players[playerName];
    if (!player || !player.entity) throw new Error(`Player ${playerName} not found or not visible`);

    this.currentTarget = { type: 'player', playerName, position: player.entity.position };
    this.isNavigating = true;

    const goal = new goals.GoalFollow(player.entity, distance);
    const dynamic = Boolean(options.dynamic);
    (this.bot as any).pathfinder.setGoal(goal, dynamic);

    // on considère "atteint" quand pathfinder signale un goal_reached (ex : assez proche)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.isNavigating = false;
        reject(new Error('Navigation timeout'));
      }, options.timeout ?? 30_000);

      const onGoalReached = () => {
        clearTimeout(timeout);
        this.bot.removeListener('goal_reached', onGoalReached);
        this.isNavigating = false;
        resolve();
      };
      this.bot.on('goal_reached', onGoalReached);
    });
  }

  async navigateToBlock(blockType: string, maxDistance = 64, options: NavigationOptions = {}): Promise<void> {
    if (!(this.bot as any).pathfinder) throw new Error('Pathfinder plugin not loaded');

    const block = this.bot.findBlock({
      matching: (candidate: any) => candidate?.name === blockType,
      maxDistance
    });
    if (!block) throw new Error(`No ${blockType} block found within ${maxDistance} blocks`);

    this.currentTarget = { type: 'block', blockType, position: block.position };
    await this.navigateToPosition(block.position, options);
  }

  followPlayer(playerName: string, distance = 3, continuous = false): void {
    if (!(this.bot as any).pathfinder) throw new Error('Pathfinder plugin not loaded');
    const player = this.bot.players[playerName];
    if (!player || !player.entity) throw new Error(`Player ${playerName} not found or not visible`);

    this.stopFollowing();

    this.followingPlayer = playerName;
    this.followDistance = Math.max(1, distance | 0);
    this.followContinuous = Boolean(continuous);

    const goal = new goals.GoalFollow(player.entity, this.followDistance);
    (this.bot as any).pathfinder.setGoal(goal, this.followContinuous);

    if (this.followContinuous) this.startContinuousFollow();
  }

  private startContinuousFollow(): void {
    if (this.navigationInterval) clearInterval(this.navigationInterval);

    this.navigationInterval = setInterval(() => {
      if (!this.followingPlayer) return;
      const p = this.bot.players[this.followingPlayer];
      if (!p || !p.entity) {
        console.log(`[navigation] Player ${this.followingPlayer} not visible -> stop follow`);
        this.stopFollowing();
        if ((this.bot as any).pathfinder) (this.bot as any).pathfinder.setGoal(null);
      }
    }, 1000);
  }

  stopFollowing(): void {
    this.followingPlayer = null;
    this.followContinuous = false;
    if (this.navigationInterval) {
      clearInterval(this.navigationInterval);
      this.navigationInterval = null;
    }
  }

  stop(): void {
    if ((this.bot as any).pathfinder) (this.bot as any).pathfinder.setGoal(null);
    this.isNavigating = false;
    this.currentTarget = null;
    this.stopFollowing();
    this.bot.clearControlStates();
  }

  lookAtPosition(position: Vec3): void {
    this.bot.lookAt(position).catch(() => void 0);
  }

  lookAtPlayer(playerName: string): void {
    const player = this.bot.players[playerName];
    if (!player || !player.entity) throw new Error(`Player ${playerName} not found or not visible`);
    this.bot.lookAt(player.entity.position.offset(0, player.entity.height, 0)).catch(() => void 0);
  }

  lookAtBlock(position: Vec3): void {
    const block = this.bot.blockAt(position);
    if (block) this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5)).catch(() => void 0);
  }

  getPhysicsState(): PhysicsState {
    const entity: any = this.bot.entity;
    return {
      velocity: entity.velocity,
      onGround: entity.onGround,
      inWater: entity.isInWater ?? false,
      inLava: entity.isInLava ?? false,
      isClimbing: entity.isClimbing ?? false,
      isFlying: entity.isFlying ?? false
    };
  }

  getCurrentTarget(): NavigationTarget | null {
    return this.currentTarget;
  }

  isCurrentlyNavigating(): boolean {
    return this.isNavigating;
  }

  getFollowStatus(): { following: string | null; distance: number; continuous: boolean } {
    return { following: this.followingPlayer, distance: this.followDistance, continuous: this.followContinuous };
  }

  async smartMove(target: Vec3, options: NavigationOptions = {}): Promise<void> {
    const d = this.bot.entity.position.distanceTo(target);
    if (d < 3) {
      await this.navigateToPosition(target, { ...options, sprint: false });
    } else if (d < 10) {
      await this.navigateToPosition(target, { ...options, sprint: true });
    } else {
      await this.navigateToPosition(target, { ...options, sprint: true, allowDigging: true, timeout: options.timeout ?? 60_000 });
    }
  }

  async emergencyStop(): Promise<void> {
    this.stop();
    this.bot.clearControlStates();
    await new Promise<void>((r) => setTimeout(r, 100));
  }
}
