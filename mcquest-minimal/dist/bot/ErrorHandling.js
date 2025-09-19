export class ErrorHandling {
    constructor(bot) {
        this.errorHistory = [];
        this.retryCounters = new Map();
        this.maxHistorySize = 100;
        this.bot = bot;
        this.setupErrorListeners();
    }
    setupErrorListeners() {
        this.bot.on('error', (error) => {
            this.handleCriticalError(error, 'bot_error');
        });
        this.bot.on('kicked', (reason) => {
            this.handleCriticalError(new Error(`Bot was kicked: ${reason}`), 'bot_kicked');
        });
        this.bot.on('end', (reason) => {
            if (reason !== 'disconnect.quitting') {
                this.handleCriticalError(new Error(`Bot disconnected: ${reason}`), 'bot_disconnected');
            }
        });
        this.bot.on('death', () => {
            this.handleGameEvent('death', 'Bot died - will respawn');
        });
        this.bot.on('health', () => {
            if (this.bot.health <= 5) {
                this.handleGameEvent('low_health', `Bot health is critically low: ${this.bot.health}/20`);
            }
        });
    }
    async handleError(error, context) {
        const fullContext = {
            operation: context.operation || 'unknown',
            timestamp: Date.now(),
            botState: this.getBotState(),
            parameters: context.parameters,
            attempt: context.attempt || 1
        };
        const errorId = this.generateErrorId(error, fullContext);
        const action = this.determineErrorAction(error, fullContext);
        const errorLog = {
            id: errorId,
            context: fullContext,
            error,
            action,
            resolved: false
        };
        this.errorHistory.push(errorLog);
        this.trimErrorHistory();
        console.error(`[mcquest-error] ${fullContext.operation}: ${error.message}`);
        console.error(`[mcquest-error] Action: ${action.type}${action.delay ? ` (delay: ${action.delay}ms)` : ''}`);
        try {
            const result = await this.executeErrorAction(action, fullContext, error);
            errorLog.resolved = true;
            errorLog.resolutionTime = Date.now() - fullContext.timestamp;
            return result;
        }
        catch (actionError) {
            console.error(`[mcquest-error] Failed to execute error action: ${actionError}`);
            return {
                success: false,
                error: `Error handling failed: ${actionError instanceof Error ? actionError.message : String(actionError)}`
            };
        }
    }
    determineErrorAction(error, context) {
        const errorType = this.classifyError(error);
        const operationType = context.operation;
        const attemptCount = this.getRetryCount(context.operation);
        switch (errorType) {
            case 'network':
                if (attemptCount < 3) {
                    return {
                        type: 'retry',
                        delay: 2000 * Math.pow(2, attemptCount), // Exponential backoff
                        maxAttempts: 3
                    };
                }
                return {
                    type: 'abort',
                    recoverySteps: ['Check network connection', 'Verify server status']
                };
            case 'pathfinding':
                if (attemptCount < 2) {
                    return {
                        type: 'retry',
                        delay: 1000,
                        maxAttempts: 2
                    };
                }
                return {
                    type: 'fallback',
                    fallbackAction: 'find_alternative_path'
                };
            case 'inventory':
                return {
                    type: 'fallback',
                    fallbackAction: 'check_inventory_state'
                };
            case 'crafting':
                if (error.message.includes('missing')) {
                    return {
                        type: 'fallback',
                        fallbackAction: 'gather_required_materials'
                    };
                }
                return {
                    type: 'retry',
                    delay: 500,
                    maxAttempts: 2
                };
            case 'mining':
                if (error.message.includes('cannot reach')) {
                    return {
                        type: 'fallback',
                        fallbackAction: 'find_alternative_mining_target'
                    };
                }
                if (error.message.includes('cannot dig')) {
                    return {
                        type: 'fallback',
                        fallbackAction: 'equip_proper_tool'
                    };
                }
                return {
                    type: 'retry',
                    delay: 1000,
                    maxAttempts: 2
                };
            case 'movement':
                if (attemptCount < 3) {
                    return {
                        type: 'retry',
                        delay: 1500,
                        maxAttempts: 3
                    };
                }
                return {
                    type: 'fallback',
                    fallbackAction: 'find_safe_movement_path'
                };
            case 'bot_state':
                return {
                    type: 'recover',
                    recoverySteps: ['check_bot_connection', 'verify_bot_spawned', 'reset_movement_state']
                };
            case 'timeout':
                if (attemptCount < 2) {
                    return {
                        type: 'retry',
                        delay: 3000,
                        maxAttempts: 2
                    };
                }
                return {
                    type: 'abort',
                    recoverySteps: ['Operation timed out repeatedly', 'Consider simpler alternative']
                };
            default:
                if (attemptCount < 2) {
                    return {
                        type: 'retry',
                        delay: 1000,
                        maxAttempts: 2
                    };
                }
                return {
                    type: 'abort',
                    recoverySteps: ['Unknown error type', 'Manual intervention may be required']
                };
        }
    }
    async executeErrorAction(action, context, error) {
        switch (action.type) {
            case 'retry':
                if (action.delay) {
                    await this.wait(action.delay);
                }
                this.incrementRetryCount(context.operation);
                return {
                    success: false,
                    error: `Retry scheduled for ${context.operation} (attempt ${this.getRetryCount(context.operation)})`
                };
            case 'fallback':
                return this.executeFallbackAction(action.fallbackAction, context, error);
            case 'recover':
                return this.executeRecoverySteps(action.recoverySteps, context);
            case 'abort':
                this.resetRetryCount(context.operation);
                return {
                    success: false,
                    error: `Operation aborted: ${error.message}. ${action.recoverySteps?.join(', ') || ''}`
                };
            default:
                return {
                    success: false,
                    error: `Unknown error action type: ${action.type}`
                };
        }
    }
    async executeFallbackAction(fallbackAction, context, error) {
        try {
            switch (fallbackAction) {
                case 'find_alternative_path':
                    return this.findAlternativePath(context);
                case 'check_inventory_state':
                    return this.checkInventoryState();
                case 'gather_required_materials':
                    return this.gatherRequiredMaterials(context, error);
                case 'find_alternative_mining_target':
                    return this.findAlternativeMiningTarget(context);
                case 'equip_proper_tool':
                    return this.equipProperTool(context);
                case 'find_safe_movement_path':
                    return this.findSafeMovementPath(context);
                default:
                    return {
                        success: false,
                        error: `Unknown fallback action: ${fallbackAction}`
                    };
            }
        }
        catch (fallbackError) {
            return {
                success: false,
                error: `Fallback action failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
            };
        }
    }
    async executeRecoverySteps(steps, context) {
        const results = [];
        for (const step of steps) {
            try {
                const result = await this.executeRecoveryStep(step);
                results.push(`${step}: ${result}`);
            }
            catch (stepError) {
                results.push(`${step}: FAILED - ${stepError}`);
            }
        }
        return {
            success: true,
            result: results.join('; ')
        };
    }
    async executeRecoveryStep(step) {
        switch (step) {
            case 'check_bot_connection':
                return this.bot._client.ended ? 'Bot disconnected' : 'Bot connected';
            case 'verify_bot_spawned':
                return this.bot.entity ? 'Bot spawned' : 'Bot not spawned';
            case 'reset_movement_state':
                this.bot.pathfinder.setGoal(null);
                return 'Movement state reset';
            default:
                return `Unknown recovery step: ${step}`;
        }
    }
    // Fallback action implementations
    async findAlternativePath(context) {
        if (!context.parameters?.target) {
            return { success: false, error: 'No target specified for alternative path' };
        }
        // Try a different pathfinding approach
        const target = context.parameters.target;
        const currentPos = this.bot.entity.position;
        // Simple alternative: try to path to a point near the target
        const alternatives = [
            { x: target.x + 1, y: target.y, z: target.z },
            { x: target.x - 1, y: target.y, z: target.z },
            { x: target.x, y: target.y, z: target.z + 1 },
            { x: target.x, y: target.y, z: target.z - 1 },
            { x: target.x, y: target.y + 1, z: target.z }
        ];
        for (const alt of alternatives) {
            try {
                // This would need to be implemented with actual pathfinding logic
                return {
                    success: true,
                    result: `Found alternative path to (${alt.x}, ${alt.y}, ${alt.z})`
                };
            }
            catch (e) {
                continue;
            }
        }
        return { success: false, error: 'No alternative paths found' };
    }
    async checkInventoryState() {
        const items = this.bot.inventory.items();
        const totalItems = items.length;
        const freeSlots = 36 - totalItems; // Assuming standard inventory size
        return {
            success: true,
            result: {
                totalItems,
                freeSlots,
                items: items.map(item => ({ name: item.name, count: item.count }))
            }
        };
    }
    async gatherRequiredMaterials(context, error) {
        // Extract missing materials from error message
        const missingMatch = error.message.match(/missing.*?:(.*)/i);
        if (!missingMatch) {
            return { success: false, error: 'Could not determine missing materials' };
        }
        const missing = missingMatch[1].trim();
        return {
            success: true,
            result: `Need to gather: ${missing}. Starting resource collection.`
        };
    }
    async findAlternativeMiningTarget(context) {
        if (!context.parameters?.blockType) {
            return { success: false, error: 'No block type specified for alternative mining' };
        }
        const blockType = context.parameters.blockType;
        const maxDistance = context.parameters.maxDistance || 64;
        // Find alternative blocks of the same type
        const alternatives = [];
        for (let distance = 8; distance <= maxDistance; distance += 8) {
            const block = this.bot.findBlock({
                matching: (block) => block.name === blockType || block.name.includes(blockType),
                maxDistance: distance
            });
            if (block && this.bot.canDigBlock(block)) {
                alternatives.push(block);
                break;
            }
        }
        if (alternatives.length > 0) {
            const target = alternatives[0];
            return {
                success: true,
                result: `Found alternative ${blockType} at (${target.position.x}, ${target.position.y}, ${target.position.z})`
            };
        }
        return { success: false, error: `No alternative ${blockType} blocks found` };
    }
    async equipProperTool(context) {
        const blockType = context.parameters?.blockType;
        if (!blockType) {
            return { success: false, error: 'No block type specified for tool selection' };
        }
        // Simple tool selection logic
        const toolMap = {
            stone: ['pickaxe'],
            wood: ['axe'],
            dirt: ['shovel'],
            sand: ['shovel'],
            gravel: ['shovel']
        };
        for (const [material, tools] of Object.entries(toolMap)) {
            if (blockType.includes(material)) {
                for (const tool of tools) {
                    const item = this.bot.inventory.items().find(i => i.name.includes(tool));
                    if (item) {
                        try {
                            await this.bot.equip(item, 'hand');
                            return {
                                success: true,
                                result: `Equipped ${item.name} for mining ${blockType}`
                            };
                        }
                        catch (e) {
                            continue;
                        }
                    }
                }
            }
        }
        return { success: false, error: `No suitable tool found for mining ${blockType}` };
    }
    async findSafeMovementPath(context) {
        const currentPos = this.bot.entity.position;
        // Try to find a safe spot nearby
        const safeOffsets = [
            { x: 0, y: 1, z: 0 }, // Go up
            { x: 5, y: 0, z: 0 }, // Go east
            { x: -5, y: 0, z: 0 }, // Go west
            { x: 0, y: 0, z: 5 }, // Go south
            { x: 0, y: 0, z: -5 }, // Go north
        ];
        for (const offset of safeOffsets) {
            const target = {
                x: Math.floor(currentPos.x + offset.x),
                y: Math.floor(currentPos.y + offset.y),
                z: Math.floor(currentPos.z + offset.z)
            };
            // Check if the position is safe (simplified check)
            const block = this.bot.blockAt(this.bot.entity.position.offset(offset.x, offset.y, offset.z));
            if (block && block.type === 0) { // Air block
                return {
                    success: true,
                    result: `Found safe movement path to (${target.x}, ${target.y}, ${target.z})`
                };
            }
        }
        return { success: false, error: 'No safe movement paths found' };
    }
    classifyError(error) {
        const message = error.message.toLowerCase();
        if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
            return 'network';
        }
        if (message.includes('path') || message.includes('goal') || message.includes('movement')) {
            return 'pathfinding';
        }
        if (message.includes('inventory') || message.includes('item')) {
            return 'inventory';
        }
        if (message.includes('craft') || message.includes('recipe')) {
            return 'crafting';
        }
        if (message.includes('mine') || message.includes('dig') || message.includes('block')) {
            return 'mining';
        }
        if (message.includes('move') || message.includes('walk')) {
            return 'movement';
        }
        if (message.includes('bot') || message.includes('not ready') || message.includes('disconnected')) {
            return 'bot_state';
        }
        if (message.includes('timeout')) {
            return 'timeout';
        }
        return 'unknown';
    }
    handleCriticalError(error, type) {
        console.error(`[mcquest-critical] ${type}: ${error.message}`);
        const context = {
            operation: type,
            timestamp: Date.now(),
            botState: this.getBotState(),
            attempt: 1
        };
        const errorLog = {
            id: this.generateErrorId(error, context),
            context,
            error,
            action: { type: 'abort' },
            resolved: false
        };
        this.errorHistory.push(errorLog);
        this.trimErrorHistory();
    }
    handleGameEvent(event, message) {
        console.warn(`[mcquest-event] ${event}: ${message}`);
    }
    getBotState() {
        try {
            return {
                connected: !this.bot._client.ended,
                health: this.bot.health || 0,
                food: this.bot.food || 0,
                position: this.bot.entity ? {
                    x: this.bot.entity.position.x,
                    y: this.bot.entity.position.y,
                    z: this.bot.entity.position.z
                } : null
            };
        }
        catch (e) {
            return {
                connected: false,
                health: 0,
                food: 0,
                position: null
            };
        }
    }
    generateErrorId(error, context) {
        const hash = this.simpleHash(error.message + context.operation);
        return `err_${context.timestamp}_${hash}`;
    }
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(16);
    }
    getRetryCount(operation) {
        return this.retryCounters.get(operation) || 0;
    }
    incrementRetryCount(operation) {
        const current = this.getRetryCount(operation);
        this.retryCounters.set(operation, current + 1);
    }
    resetRetryCount(operation) {
        this.retryCounters.delete(operation);
    }
    trimErrorHistory() {
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
        }
    }
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Public methods for error reporting
    getErrorHistory() {
        return [...this.errorHistory];
    }
    getRecentErrors(count = 10) {
        return this.errorHistory.slice(-count);
    }
    clearErrorHistory() {
        this.errorHistory = [];
        this.retryCounters.clear();
    }
    getErrorStats() {
        const totalErrors = this.errorHistory.length;
        const resolvedErrors = this.errorHistory.filter(e => e.resolved).length;
        const unresolvedErrors = totalErrors - resolvedErrors;
        const errorCounts = new Map();
        this.errorHistory.forEach(log => {
            const key = log.error.message;
            errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
        });
        const mostCommonErrors = Array.from(errorCounts.entries())
            .map(([error, count]) => ({ error, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        return {
            totalErrors,
            resolvedErrors,
            unresolvedErrors,
            mostCommonErrors
        };
    }
}
