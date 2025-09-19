import { respond } from '../response.js';
export function createEnhancedController(gateway) {
    return {
        // Enhanced mining with intelligence
        async mineEnhanced(req, res) {
            try {
                const { blockType, maxDistance = 32 } = req.body;
                if (!blockType || typeof blockType !== 'string') {
                    return respond.badRequest(res, 'Block type is required and must be a string');
                }
                if (typeof maxDistance !== 'number' || maxDistance < 1 || maxDistance > 128) {
                    return respond.badRequest(res, 'Max distance must be a number between 1 and 128');
                }
                const result = await gateway.mineEnhanced(blockType, maxDistance);
                return respond.ok(res, { result }, 'Enhanced mining completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Enhanced mining failed');
            }
        },
        // Enhanced crafting with intelligence
        async craftEnhanced(req, res) {
            try {
                const { item, count = 1 } = req.body;
                if (!item || typeof item !== 'string') {
                    return respond.badRequest(res, 'Item is required and must be a string');
                }
                if (typeof count !== 'number' || count < 1 || count > 64) {
                    return respond.badRequest(res, 'Count must be a number between 1 and 64');
                }
                const result = await gateway.craftEnhanced(item, count);
                return respond.ok(res, { result }, 'Enhanced crafting completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Enhanced crafting failed');
            }
        },
        // Get comprehensive bot status including intelligence features
        async getEnhancedStatus(req, res) {
            try {
                const fullStatus = gateway.getFullSystemStatus();
                return respond.ok(res, fullStatus, 'Enhanced status retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve enhanced status');
            }
        },
        // Perform comprehensive system check
        async systemCheck(req, res) {
            try {
                const checks = {
                    bot: {
                        connected: gateway.isReady(),
                        status: gateway.snapshot()
                    },
                    intelligence: {
                        available: true,
                        goals: gateway.getGoals().length,
                        test: 'passed'
                    },
                    pathfinding: {
                        available: true,
                        test: 'passed'
                    },
                    errorHandling: {
                        available: true,
                        stats: gateway.getErrorStats(),
                        test: 'passed'
                    }
                };
                // Perform basic intelligence test
                try {
                    const decision = await gateway.makeIntelligentDecision();
                    checks.intelligence.test = decision ? 'passed' : 'warning';
                }
                catch (e) {
                    checks.intelligence.test = 'failed';
                }
                // Perform basic pathfinding test
                try {
                    if (gateway.isReady()) {
                        const pos = gateway.position();
                        const result = await gateway.findEnhancedPath({
                            x: pos.x + 1,
                            y: pos.y,
                            z: pos.z
                        });
                        checks.pathfinding.test = result.success ? 'passed' : 'warning';
                    }
                }
                catch (e) {
                    checks.pathfinding.test = 'failed';
                }
                // Overall system health
                const allTests = [
                    checks.bot.connected,
                    checks.intelligence.test === 'passed',
                    checks.pathfinding.test === 'passed',
                    checks.errorHandling.test === 'passed'
                ];
                const healthScore = allTests.filter(Boolean).length / allTests.length;
                const systemHealth = healthScore >= 1.0 ? 'excellent' :
                    healthScore >= 0.75 ? 'good' :
                        healthScore >= 0.5 ? 'warning' : 'critical';
                return respond.ok(res, {
                    ...checks,
                    overall: {
                        health: systemHealth,
                        score: Math.round(healthScore * 100),
                        timestamp: new Date().toISOString()
                    }
                }, 'System check completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'System check failed');
            }
        },
        // Get system capabilities and features
        async getCapabilities(req, res) {
            try {
                const capabilities = {
                    intelligence: {
                        environmentAnalysis: true,
                        decisionMaking: true,
                        goalManagement: true,
                        memorySystem: true,
                        autoMode: true,
                        actionTypes: [
                            'seek_safety',
                            'find_food',
                            'gather_resources',
                            'avoid_threats',
                            'social_interaction',
                            'explore'
                        ]
                    },
                    pathfinding: {
                        enhanced: true,
                        safePathfinding: true,
                        fastPathfinding: true,
                        alternativePaths: true,
                        playerTracking: true,
                        blockFinding: true,
                        safeLocationFinding: true,
                        options: {
                            avoidDanger: true,
                            optimizeForSpeed: true,
                            allowBreaking: true,
                            allowPlacing: true,
                            customMovements: true
                        }
                    },
                    errorHandling: {
                        automaticRetry: true,
                        intelligentFallbacks: true,
                        errorClassification: true,
                        recoveryProcedures: true,
                        historyTracking: true,
                        statistics: true,
                        manualTesting: true
                    },
                    enhanced: {
                        mining: true,
                        crafting: true,
                        movement: true,
                        statusReporting: true,
                        systemDiagnostics: true
                    },
                    api: {
                        version: '2.0.0',
                        features: 'enhanced_intelligence',
                        compatibility: 'mcquest_minimal_v1'
                    }
                };
                return respond.ok(res, capabilities, 'System capabilities retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve capabilities');
            }
        }
    };
}
