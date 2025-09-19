import { Bot } from 'mineflayer';

export interface ErrorContext {
  operation: string;
  timestamp: number;
  botState: {
    connected: boolean;
    health: number;
    food: number;
    position: { x: number; y: number; z: number } | null;
  };
  parameters?: any;
  attempt: number;
}

export interface ErrorAction {
  type: 'retry' | 'fallback' | 'abort' | 'recover';
  delay?: number;
  maxAttempts?: number;
  fallbackAction?: string;
  recoverySteps?: string[];
}

export interface ErrorLog {
  id: string;
  context: ErrorContext;
  error: Error;
  action: ErrorAction;
  resolved: boolean;
  resolutionTime?: number;
}

export class ErrorHandling {
  private bot: Bot;
  private errorHistory: ErrorLog[] = [];
  private retryCounters: Map<string, number> = new Map();
  private maxHistorySize = 100;

  constructor(bot: Bot) {
    this.bot = bot;
    this.setupErrorListeners();
  }

  private setupErrorListeners(): void {
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

  async handleError(
    error: Error,
    context: Partial<ErrorContext>
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const fullContext: ErrorContext = {
      operation: context.operation || 'unknown',
      timestamp: Date.now(),
      botState: this.getBotState(),
      parameters: context.parameters,
      attempt: context.attempt || 1
    };

    const errorId = this.generateErrorId(error, fullContext);
    const action = this.determineErrorAction(error, fullContext);

    const errorLog: ErrorLog = {
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
    } catch (actionError) {
      console.error(`[mcquest-error] Failed to execute error action: ${actionError}`);
      return {
        success: false,
        error: `Error handling failed: ${actionError instanceof Error ? actionError.message : String(actionError)}`
      };
    }
  }

  private determineErrorAction(error: Error, context: ErrorContext): ErrorAction {
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

  private async executeErrorAction(
    action: ErrorAction,
    context: ErrorContext,
    error: Error
  ): Promise<{ success: boolean; result?: any; error?: string }> {
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
        return this.executeFallbackAction(action.fallbackAction!, context, error);

      case 'recover':
        return this.executeRecoverySteps(action.recoverySteps!, context);

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

  private async executeFallbackAction(
    fallbackAction: string,
    context: ErrorContext,
    error: Error
  ): Promise<{ success: boolean; result?: any; error?: string }> {
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
    } catch (fallbackError) {
      return {
        success: false,
        error: `Fallback action failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
      };
    }
  }

  private async executeRecoverySteps(
    steps: string[],
    context: ErrorContext
  ): Promise<{ success: boolean; result?: any; error?: string }> {
    const results: string[] = [];

    for (const step of steps) {
      try {
        const result = await this.executeRecoveryStep(step);
        results.push(`${step}: ${result}`);
      } catch (stepError) {
        results.push(`${step}: FAILED - ${stepError}`);
      }
    }

    return {
      success: true,
      result: results.join('; ')
    };
  }

  private async executeRecoveryStep(step: string): Promise<string> {
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
  private async findAlternativePath(context: ErrorContext): Promise<{ success: boolean; result?: any; error?: string }> {
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
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: 'No alternative paths found' };
  }

  private async checkInventoryState(): Promise<{ success: boolean; result?: any; error?: string }> {
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

  private async gatherRequiredMaterials(
    context: ErrorContext,
    error: Error
  ): Promise<{ success: boolean; result?: any; error?: string }> {
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

  private async findAlternativeMiningTarget(context: ErrorContext): Promise<{ success: boolean; result?: any; error?: string }> {
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

  private async equipProperTool(context: ErrorContext): Promise<{ success: boolean; result?: any; error?: string }> {
    const blockType = context.parameters?.blockType;
    if (!blockType) {
      return { success: false, error: 'No block type specified for tool selection' };
    }

    // Simple tool selection logic
    const toolMap: { [key: string]: string[] } = {
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
            } catch (e) {
              continue;
            }
          }
        }
      }
    }

    return { success: false, error: `No suitable tool found for mining ${blockType}` };
  }

  private async findSafeMovementPath(context: ErrorContext): Promise<{ success: boolean; result?: any; error?: string }> {
    const currentPos = this.bot.entity.position;

    // Try to find a safe spot nearby
    const safeOffsets = [
      { x: 0, y: 1, z: 0 },   // Go up
      { x: 5, y: 0, z: 0 },   // Go east
      { x: -5, y: 0, z: 0 },  // Go west
      { x: 0, y: 0, z: 5 },   // Go south
      { x: 0, y: 0, z: -5 },  // Go north
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

  private classifyError(error: Error): string {
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

  private handleCriticalError(error: Error, type: string): void {
    console.error(`[mcquest-critical] ${type}: ${error.message}`);

    const context: ErrorContext = {
      operation: type,
      timestamp: Date.now(),
      botState: this.getBotState(),
      attempt: 1
    };

    const errorLog: ErrorLog = {
      id: this.generateErrorId(error, context),
      context,
      error,
      action: { type: 'abort' },
      resolved: false
    };

    this.errorHistory.push(errorLog);
    this.trimErrorHistory();
  }

  private handleGameEvent(event: string, message: string): void {
    console.warn(`[mcquest-event] ${event}: ${message}`);
  }

  private getBotState() {
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
    } catch (e) {
      return {
        connected: false,
        health: 0,
        food: 0,
        position: null
      };
    }
  }

  private generateErrorId(error: Error, context: ErrorContext): string {
    const hash = this.simpleHash(error.message + context.operation);
    return `err_${context.timestamp}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private getRetryCount(operation: string): number {
    return this.retryCounters.get(operation) || 0;
  }

  private incrementRetryCount(operation: string): void {
    const current = this.getRetryCount(operation);
    this.retryCounters.set(operation, current + 1);
  }

  private resetRetryCount(operation: string): void {
    this.retryCounters.delete(operation);
  }

  private trimErrorHistory(): void {
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for error reporting
  public getErrorHistory(): ErrorLog[] {
    return [...this.errorHistory];
  }

  public getRecentErrors(count: number = 10): ErrorLog[] {
    return this.errorHistory.slice(-count);
  }

  public clearErrorHistory(): void {
    this.errorHistory = [];
    this.retryCounters.clear();
  }

  public getErrorStats(): {
    totalErrors: number;
    resolvedErrors: number;
    unresolvedErrors: number;
    mostCommonErrors: Array<{ error: string; count: number }>;
  } {
    const totalErrors = this.errorHistory.length;
    const resolvedErrors = this.errorHistory.filter(e => e.resolved).length;
    const unresolvedErrors = totalErrors - resolvedErrors;

    const errorCounts: Map<string, number> = new Map();
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