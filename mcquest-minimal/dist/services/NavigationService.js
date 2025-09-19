export class NavigationService {
    constructor(bot) {
        this.bot = bot;
        this.currentTarget = null;
        this.isNavigating = false;
        this.followingPlayer = null;
        this.followDistance = 3;
        this.followContinuous = false;
        this.navigationInterval = null;
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.bot.on('goal_reached', () => {
            console.log('[navigation] Goal reached');
            this.isNavigating = false;
            this.currentTarget = null;
        });
        this.bot.on('path_update', (result) => {
            if (result.status === 'noPath') {
                console.log('[navigation] No path found to target');
                this.isNavigating = false;
            }
        });
        this.bot.on('goal_updated', () => {
            console.log('[navigation] Goal updated');
        });
    }
    async navigateToPosition(position, options = {}) {
        if (!this.bot.pathfinder) {
            throw new Error('Pathfinder plugin not loaded');
        }
        const target = {
            type: 'position',
            position
        };
        this.currentTarget = target;
        this.isNavigating = true;
        const defaultOptions = {
            timeout: 30000,
            sprint: true,
            avoidWater: false,
            avoidLava: true,
            allowDigging: false,
            allowPlacing: false,
            ...options
        };
        try {
            const goals = this.bot.pathfinder.goals;
            const goal = new goals.GoalBlock(position.x, position.y, position.z);
            this.bot.pathfinder.setGoal(goal, defaultOptions.allowDigging);
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.isNavigating = false;
                    reject(new Error('Navigation timeout'));
                }, defaultOptions.timeout);
                const onGoalReached = () => {
                    clearTimeout(timeout);
                    this.bot.removeListener('goal_reached', onGoalReached);
                    this.bot.removeListener('path_update', onPathUpdate);
                    this.isNavigating = false;
                    resolve();
                };
                const onPathUpdate = (result) => {
                    if (result.status === 'noPath') {
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
        catch (error) {
            this.isNavigating = false;
            throw error;
        }
    }
    async navigateToPlayer(playerName, distance = 3, options = {}) {
        const player = this.bot.players[playerName];
        if (!player || !player.entity) {
            throw new Error(`Player ${playerName} not found or not visible`);
        }
        if (!this.bot.pathfinder) {
            throw new Error('Pathfinder plugin not loaded');
        }
        const target = {
            type: 'player',
            playerName,
            position: player.entity.position
        };
        this.currentTarget = target;
        this.isNavigating = true;
        try {
            const goals = this.bot.pathfinder.goals;
            const goal = new goals.GoalFollow(player.entity, distance);
            const dynamic = options.dynamic ?? false;
            this.bot.pathfinder.setGoal(goal, dynamic);
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.isNavigating = false;
                    reject(new Error('Navigation timeout'));
                }, options.timeout ?? 30000);
                const onGoalReached = () => {
                    clearTimeout(timeout);
                    this.bot.removeListener('goal_reached', onGoalReached);
                    this.isNavigating = false;
                    resolve();
                };
                this.bot.on('goal_reached', onGoalReached);
            });
        }
        catch (error) {
            this.isNavigating = false;
            throw error;
        }
    }
    async navigateToBlock(blockType, maxDistance = 64, options = {}) {
        if (!this.bot.pathfinder) {
            throw new Error('Pathfinder plugin not loaded');
        }
        const block = this.bot.findBlock({
            matching: (candidate) => candidate.name === blockType,
            maxDistance
        });
        if (!block) {
            throw new Error(`No ${blockType} block found within ${maxDistance} blocks`);
        }
        const target = {
            type: 'block',
            blockType,
            position: block.position
        };
        this.currentTarget = target;
        await this.navigateToPosition(block.position, options);
    }
    followPlayer(playerName, distance = 3, continuous = false) {
        if (!this.bot.pathfinder) {
            throw new Error('Pathfinder plugin not loaded');
        }
        const player = this.bot.players[playerName];
        if (!player || !player.entity) {
            throw new Error(`Player ${playerName} not found or not visible`);
        }
        this.stopFollowing();
        this.followingPlayer = playerName;
        this.followDistance = distance;
        this.followContinuous = continuous;
        const goals = this.bot.pathfinder.goals;
        const goal = new goals.GoalFollow(player.entity, distance);
        this.bot.pathfinder.setGoal(goal, continuous);
        if (continuous) {
            this.startContinuousFollow();
        }
    }
    startContinuousFollow() {
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
        }
        this.navigationInterval = setInterval(() => {
            if (!this.followingPlayer) {
                return;
            }
            const player = this.bot.players[this.followingPlayer];
            if (!player || !player.entity) {
                console.log(`[navigation] Player ${this.followingPlayer} not found, stopping follow`);
                this.stopFollowing();
                if (this.bot.pathfinder) {
                    this.bot.pathfinder.setGoal(null);
                }
            }
        }, 1000);
    }
    stopFollowing() {
        this.followingPlayer = null;
        this.followContinuous = false;
        if (this.navigationInterval) {
            clearInterval(this.navigationInterval);
            this.navigationInterval = null;
        }
    }
    stop() {
        if (this.bot.pathfinder) {
            this.bot.pathfinder.setGoal(null);
        }
        this.isNavigating = false;
        this.currentTarget = null;
        this.stopFollowing();
        this.bot.clearControlStates();
    }
    lookAtPosition(position) {
        this.bot.lookAt(position);
    }
    lookAtPlayer(playerName) {
        const player = this.bot.players[playerName];
        if (!player || !player.entity) {
            throw new Error(`Player ${playerName} not found or not visible`);
        }
        this.bot.lookAt(player.entity.position.offset(0, player.entity.height, 0));
    }
    lookAtBlock(position) {
        const block = this.bot.blockAt(position);
        if (block) {
            this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
        }
    }
    getPhysicsState() {
        const entity = this.bot.entity;
        return {
            velocity: entity.velocity,
            onGround: entity.onGround,
            inWater: entity.isInWater ?? false,
            inLava: entity.isInLava ?? false,
            isClimbing: entity.isClimbing ?? false,
            isFlying: entity.isFlying ?? false
        };
    }
    getCurrentTarget() {
        return this.currentTarget;
    }
    isCurrentlyNavigating() {
        return this.isNavigating;
    }
    getFollowStatus() {
        return {
            following: this.followingPlayer,
            distance: this.followDistance,
            continuous: this.followContinuous
        };
    }
    async smartMove(target, options = {}) {
        const distance = this.bot.entity.position.distanceTo(target);
        if (distance < 3) {
            this.bot.lookAt(target);
            await this.navigateToPosition(target, { ...options, sprint: false });
            return;
        }
        if (distance < 10) {
            await this.navigateToPosition(target, { ...options, sprint: true });
            return;
        }
        await this.navigateToPosition(target, {
            ...options,
            sprint: true,
            allowDigging: true,
            timeout: options.timeout ?? 60000
        });
    }
    async emergencyStop() {
        this.stop();
        this.bot.clearControlStates();
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}
