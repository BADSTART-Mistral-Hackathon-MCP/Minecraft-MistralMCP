import { respond } from '../response.js';
export function createIntelligenceController(gateway) {
    return {
        // Analyze the environment around the bot
        async analyzeEnvironment(req, res) {
            try {
                const radius = parseInt(req.query.radius) || 32;
                if (radius < 1 || radius > 128) {
                    return respond.badRequest(res, 'Radius must be between 1 and 128');
                }
                const analysis = await gateway.analyzeEnvironment(radius);
                return respond.ok(res, analysis, 'Environment analysis completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Environment analysis failed');
            }
        },
        // Make an intelligent decision
        async makeDecision(req, res) {
            try {
                const decision = await gateway.makeIntelligentDecision();
                return respond.ok(res, decision, 'Decision made successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Decision making failed');
            }
        },
        // Execute an intelligent action
        async executeAction(req, res) {
            try {
                const { action, parameters = {} } = req.body;
                if (!action || typeof action !== 'string') {
                    return respond.badRequest(res, 'Action is required and must be a string');
                }
                const result = await gateway.executeIntelligentAction(action, parameters);
                return respond.ok(res, { result }, 'Action executed successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Action execution failed');
            }
        },
        // Auto mode - let the bot make autonomous decisions
        async enableAutoMode(req, res) {
            try {
                const duration = parseInt(req.body.duration) || 300000; // 5 minutes default
                if (duration < 10000 || duration > 3600000) { // 10 seconds to 1 hour
                    return respond.badRequest(res, 'Duration must be between 10000ms (10s) and 3600000ms (1h)');
                }
                const result = await gateway.enableAutoMode(duration);
                return respond.ok(res, { duration, message: result }, 'Auto mode enabled');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Auto mode failed');
            }
        },
        // Goal management
        async addGoal(req, res) {
            try {
                const { goal } = req.body;
                if (!goal || typeof goal !== 'string') {
                    return respond.badRequest(res, 'Goal is required and must be a string');
                }
                gateway.addGoal(goal);
                return respond.ok(res, { goal }, 'Goal added successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to add goal');
            }
        },
        async removeGoal(req, res) {
            try {
                const { goal } = req.body;
                if (!goal || typeof goal !== 'string') {
                    return respond.badRequest(res, 'Goal is required and must be a string');
                }
                gateway.removeGoal(goal);
                return respond.ok(res, { goal }, 'Goal removed successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to remove goal');
            }
        },
        async getGoals(req, res) {
            try {
                const goals = gateway.getGoals();
                return respond.ok(res, { goals, count: goals.length }, 'Goals retrieved successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve goals');
            }
        },
        // Memory management
        async remember(req, res) {
            try {
                const { key, value } = req.body;
                if (!key || typeof key !== 'string') {
                    return respond.badRequest(res, 'Key is required and must be a string');
                }
                if (value === undefined) {
                    return respond.badRequest(res, 'Value is required');
                }
                gateway.remember(key, value);
                return respond.ok(res, { key, value }, 'Memory stored successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to store memory');
            }
        },
        async recall(req, res) {
            try {
                const { key } = req.params;
                if (!key || typeof key !== 'string') {
                    return respond.badRequest(res, 'Key is required and must be a string');
                }
                const value = gateway.recall(key);
                return respond.ok(res, { key, value, found: value !== null }, 'Memory retrieved successfully');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve memory');
            }
        }
    };
}
