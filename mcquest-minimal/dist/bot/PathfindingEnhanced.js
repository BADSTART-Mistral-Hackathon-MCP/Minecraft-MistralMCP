import pathfinderModule from 'mineflayer-pathfinder';
const { goals, Movements } = pathfinderModule;
export class PathfindingEnhanced {
    constructor(bot) {
        this.bot = bot;
        this.defaultOptions = {
            avoidDanger: true,
            optimizeForSpeed: false,
            allowBreaking: false,
            allowPlacing: false,
            maxJumpHeight: 1,
            maxDropHeight: 3,
            timeout: 30000,
            retryCount: 3
        };
    }
    async findPathTo(target, options = {}) {
        const opts = { ...this.defaultOptions, ...options };
        const startTime = Date.now();
        try {
            // Analyze the target for safety
            const safetyMetrics = await this.analyzeSafety(target, opts);
            if (opts.avoidDanger && !safetyMetrics.safePath) {
                return {
                    success: false,
                    error: `Dangerous path detected: ${safetyMetrics.recommendations.join(', ')}`,
                    obstacles: safetyMetrics.dangerousBlocks.map(b => b.name)
                };
            }
            // Setup enhanced movements
            const movements = this.createEnhancedMovements(opts);
            this.bot.pathfinder.setMovements(movements);
            // Create goal
            const goal = new goals.GoalBlock(target.x, target.y, target.z);
            // Try pathfinding with retries
            let lastError = null;
            for (let attempt = 0; attempt < opts.retryCount; attempt++) {
                try {
                    const result = await this.attemptPathfinding(goal, opts);
                    if (result.success) {
                        return {
                            ...result,
                            estimatedTime: Date.now() - startTime,
                            alternativeRoutes: attempt
                        };
                    }
                    lastError = new Error(result.error || 'Pathfinding failed');
                }
                catch (error) {
                    lastError = error;
                    if (attempt < opts.retryCount - 1) {
                        // Modify options for retry
                        opts.allowBreaking = true;
                        opts.maxJumpHeight = Math.min(opts.maxJumpHeight + 1, 3);
                        await this.wait(1000 * (attempt + 1)); // Exponential backoff
                    }
                }
            }
            return {
                success: false,
                error: lastError?.message || 'All pathfinding attempts failed',
                estimatedTime: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown pathfinding error',
                estimatedTime: Date.now() - startTime
            };
        }
    }
    async findSafePath(target, options = {}) {
        const safeOptions = {
            ...options,
            avoidDanger: true,
            allowBreaking: false,
            allowPlacing: false
        };
        return this.findPathTo(target, safeOptions);
    }
    async findFastPath(target, options = {}) {
        const fastOptions = {
            ...options,
            optimizeForSpeed: true,
            allowBreaking: true,
            allowPlacing: true,
            maxJumpHeight: 2,
            maxDropHeight: 5
        };
        return this.findPathTo(target, fastOptions);
    }
    async findAlternativePaths(target, count = 3) {
        const results = [];
        const baseOptions = { ...this.defaultOptions };
        // Try different pathfinding strategies
        const strategies = [
            { name: 'safe', avoidDanger: true, allowBreaking: false },
            { name: 'direct', avoidDanger: false, allowBreaking: true },
            { name: 'underground', maxDropHeight: 10, allowBreaking: true },
            { name: 'aerial', maxJumpHeight: 3, allowPlacing: true }
        ];
        for (let i = 0; i < Math.min(count, strategies.length); i++) {
            const strategy = strategies[i];
            const options = { ...baseOptions, ...strategy };
            const result = await this.findPathTo(target, options);
            result.error = result.error ? `${strategy.name}: ${result.error}` : undefined;
            results.push(result);
            if (result.success) {
                // Add small delay between successful attempts to allow for different paths
                await this.wait(500);
            }
        }
        return results.sort((a, b) => {
            if (a.success && !b.success)
                return -1;
            if (!a.success && b.success)
                return 1;
            if (a.success && b.success) {
                return (a.distance || Infinity) - (b.distance || Infinity);
            }
            return 0;
        });
    }
    async attemptPathfinding(goal, options) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.bot.removeAllListeners('goal_reached');
                this.bot.removeAllListeners('path_update');
                reject(new Error('Pathfinding timeout'));
            }, options.timeout);
            const cleanup = () => {
                clearTimeout(timeout);
                this.bot.removeAllListeners('goal_reached');
                this.bot.removeAllListeners('path_update');
            };
            const onGoalReached = () => {
                cleanup();
                const path = this.bot.pathfinder.path?.path || [];
                const distance = this.calculatePathDistance(path);
                resolve({
                    success: true,
                    path: path.map((p) => ({ x: p.x, y: p.y, z: p.z })),
                    distance
                });
            };
            const onPathUpdate = (result) => {
                if (result.status === 'noPath') {
                    cleanup();
                    resolve({
                        success: false,
                        error: 'No path found to destination'
                    });
                }
                else if (result.status === 'timeout') {
                    cleanup();
                    resolve({
                        success: false,
                        error: 'Pathfinding algorithm timeout'
                    });
                }
                else if (result.status === 'partialPath') {
                    // Continue with partial path
                    const path = result.path || [];
                    const distance = this.calculatePathDistance(path);
                    cleanup();
                    resolve({
                        success: true,
                        path: path.map((p) => ({ x: p.x, y: p.y, z: p.z })),
                        distance,
                        error: 'Partial path - destination not fully reachable'
                    });
                }
            };
            this.bot.once('goal_reached', onGoalReached);
            this.bot.on('path_update', onPathUpdate);
            // Set the goal
            this.bot.pathfinder.setGoal(goal);
        });
    }
    createEnhancedMovements(options) {
        const movements = new Movements(this.bot);
        // Configure movement settings based on options
        movements.allowFreeMotion = options.optimizeForSpeed;
        movements.allow1by1towers = options.allowPlacing;
        movements.allowEntityDetection = true;
        // Set block breaking/placing preferences
        if (options.allowBreaking) {
            movements.blocksToAvoid.clear();
            movements.canDig = (block) => {
                return !this.isValuableBlock(block.name) && this.bot.canDigBlock(block);
            };
        }
        if (options.allowPlacing) {
            movements.canPlace = (block) => {
                return !this.isDangerousBlock(block.name);
            };
        }
        // Safety configurations
        if (options.avoidDanger) {
            const dangerousBlocks = ['lava', 'fire', 'magma_block', 'cactus', 'sweet_berry_bush'];
            dangerousBlocks.forEach(blockName => {
                const block = this.bot.registry.blocksByName[blockName];
                if (block) {
                    movements.blocksToAvoid.add(block.id);
                }
            });
        }
        return movements;
    }
    async analyzeSafety(target, options) {
        const dangerousBlocks = [];
        const recommendations = [];
        let dangerScore = 0;
        // Check area around target for dangers
        const radius = 5;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const pos = { x: target.x + dx, y: target.y + dy, z: target.z + dz };
                    const block = this.bot.blockAt(this.bot.entity.position.offset(dx, dy, dz));
                    if (block && this.isDangerousBlock(block.name)) {
                        dangerousBlocks.push({
                            name: block.name,
                            position: pos
                        });
                        dangerScore += this.getDangerScore(block.name);
                    }
                }
            }
        }
        // Generate recommendations
        if (dangerScore > 10) {
            recommendations.push('High danger area - consider alternative route');
        }
        if (dangerousBlocks.some(b => b.name.includes('lava'))) {
            recommendations.push('Lava detected - bring fire resistance potion');
        }
        if (dangerousBlocks.some(b => b.name.includes('cactus'))) {
            recommendations.push('Cactus field detected - path carefully');
        }
        return {
            dangerScore,
            safePath: dangerScore <= 5,
            dangerousBlocks,
            recommendations
        };
    }
    calculatePathDistance(path) {
        if (path.length < 2)
            return 0;
        let totalDistance = 0;
        for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1];
            const curr = path[i];
            totalDistance += Math.sqrt(Math.pow(curr.x - prev.x, 2) +
                Math.pow(curr.y - prev.y, 2) +
                Math.pow(curr.z - prev.z, 2));
        }
        return Math.round(totalDistance * 100) / 100;
    }
    isDangerousBlock(blockName) {
        const dangerous = ['lava', 'fire', 'magma_block', 'cactus', 'sweet_berry_bush', 'wither_rose'];
        return dangerous.some(danger => blockName.includes(danger));
    }
    isValuableBlock(blockName) {
        const valuable = ['diamond', 'emerald', 'gold', 'iron', 'ancient_debris'];
        return valuable.some(val => blockName.includes(val));
    }
    getDangerScore(blockName) {
        if (blockName.includes('lava'))
            return 10;
        if (blockName.includes('fire'))
            return 8;
        if (blockName.includes('magma'))
            return 6;
        if (blockName.includes('cactus'))
            return 4;
        return 2;
    }
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Utility methods for complex pathfinding scenarios
    async findPathToNearestBlock(blockType, maxDistance = 64) {
        const block = this.bot.findBlock({
            matching: (block) => block.name === blockType || block.name.includes(blockType),
            maxDistance
        });
        if (!block) {
            return {
                success: false,
                error: `No ${blockType} found within ${maxDistance} blocks`
            };
        }
        return this.findPathTo(block.position);
    }
    async findPathToPlayer(playerName) {
        // Get all available players and entities
        const availablePlayers = Object.keys(this.bot.players).filter(name => name !== this.bot.username);
        const playerEntities = Object.values(this.bot.entities)
            .filter(entity => entity && entity.type === 'player' && entity.username !== this.bot.username);
        console.log('[pathfinding] Available players in bot.players:', availablePlayers);
        console.log('[pathfinding] Player entities found:', playerEntities.map(e => e.username || e.name));
        // First try to find in bot.players with case-insensitive search
        let target = null;
        for (const [name, player] of Object.entries(this.bot.players)) {
            if (name.toLowerCase() === playerName.toLowerCase()) {
                target = player;
                break;
            }
        }
        // If not found in bot.players, search in entities
        if (!target || !target.entity) {
            console.log('[pathfinding] Player not found in bot.players, searching entities...');
            const playerEntity = playerEntities.find(entity => entity.username?.toLowerCase() === playerName.toLowerCase());
            if (playerEntity) {
                console.log('[pathfinding] Found player in entities:', playerEntity.username);
                target = {
                    entity: playerEntity,
                    username: playerEntity.username
                };
            }
            else {
                // If still not found, try to use nearest player
                if (playerEntities.length > 0) {
                    const nearest = playerEntities.reduce((closest, entity) => {
                        const distCurrent = this.bot.entity.position.distanceTo(entity.position);
                        const distClosest = this.bot.entity.position.distanceTo(closest.position);
                        return distCurrent < distClosest ? entity : closest;
                    });
                    console.log('[pathfinding] Using nearest player instead:', nearest.username);
                    target = {
                        entity: nearest,
                        username: nearest.username
                    };
                    playerName = nearest.username || 'nearest_player';
                }
                else {
                    return {
                        success: false,
                        error: `Player ${playerName} not found or not visible. Available players: ${availablePlayers.join(', ')}. Entities: ${playerEntities.map(e => e.username || e.name).join(', ')}`
                    };
                }
            }
        }
        const targetPosition = {
            x: target.entity.position.x,
            y: target.entity.position.y,
            z: target.entity.position.z
        };
        return this.findPathTo(targetPosition);
    }
    async findPathToSafeLocation() {
        const botPos = this.bot.entity.position;
        const candidates = [];
        // Look for safe locations in a radius
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
            for (let distance = 10; distance <= 50; distance += 10) {
                const x = Math.floor(botPos.x + Math.cos(angle) * distance);
                const z = Math.floor(botPos.z + Math.sin(angle) * distance);
                // Find suitable Y level
                for (let y = botPos.y - 5; y <= botPos.y + 10; y++) {
                    const block = this.bot.blockAt(this.bot.entity.position.offset(x - botPos.x, y - botPos.y, z - botPos.z));
                    const blockAbove = this.bot.blockAt(this.bot.entity.position.offset(x - botPos.x, y - botPos.y + 1, z - botPos.z));
                    if (block && blockAbove &&
                        block.type !== 0 &&
                        blockAbove.type === 0 &&
                        !this.isDangerousBlock(block.name)) {
                        const safetyScore = this.calculateLocationSafety({ x, y, z });
                        candidates.push({ x, y, z, score: safetyScore });
                    }
                }
            }
        }
        if (candidates.length === 0) {
            return {
                success: false,
                error: 'No safe locations found nearby'
            };
        }
        // Choose the safest location
        candidates.sort((a, b) => b.score - a.score);
        const safest = candidates[0];
        return this.findSafePath(safest);
    }
    calculateLocationSafety(pos) {
        let score = 100;
        const radius = 5;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const block = this.bot.blockAt(this.bot.entity.position.offset(pos.x - this.bot.entity.position.x + dx, pos.y - this.bot.entity.position.y + dy, pos.z - this.bot.entity.position.z + dz));
                    if (block && this.isDangerousBlock(block.name)) {
                        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        score -= this.getDangerScore(block.name) / Math.max(1, distance);
                    }
                }
            }
        }
        return Math.max(0, score);
    }
}
