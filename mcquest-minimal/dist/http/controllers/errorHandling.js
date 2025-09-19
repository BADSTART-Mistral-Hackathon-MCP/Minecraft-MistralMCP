import { respond } from '../response.js';
export function createErrorHandlingController(gateway) {
    return {
        // Get error history
        async getErrorHistory(req, res) {
            try {
                const limit = parseInt(req.query.limit) || 50;
                const history = gateway.getErrorHistory();
                const limitedHistory = limit > 0 ? history.slice(-limit) : history;
                return respond.ok(res, {
                    errors: limitedHistory,
                    total: history.length,
                    showing: limitedHistory.length
                }, 'Error history retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve error history');
            }
        },
        // Get recent errors
        async getRecentErrors(req, res) {
            try {
                const count = parseInt(req.query.count) || 10;
                if (count < 1 || count > 100) {
                    return respond.badRequest(res, 'Count must be between 1 and 100');
                }
                const errors = gateway.getRecentErrors(count);
                return respond.ok(res, {
                    errors,
                    count: errors.length
                }, 'Recent errors retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve recent errors');
            }
        },
        // Get error statistics
        async getErrorStats(req, res) {
            try {
                const stats = gateway.getErrorStats();
                return respond.ok(res, stats, 'Error statistics retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve error statistics');
            }
        },
        // Clear error history
        async clearErrorHistory(req, res) {
            try {
                gateway.clearErrorHistory();
                return respond.ok(res, {
                    cleared: true,
                    timestamp: new Date().toISOString()
                }, 'Error history cleared');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to clear error history');
            }
        },
        // Manual error handling test
        async testErrorHandling(req, res) {
            try {
                const { errorType = 'test', message = 'Manual error test' } = req.body;
                const testError = new Error(message);
                const result = await gateway.handleError(testError, {
                    operation: 'manual_test',
                    parameters: { errorType, message }
                });
                return respond.ok(res, result, 'Error handling test completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Error handling test failed');
            }
        },
        // Get error handling capabilities
        async getCapabilities(req, res) {
            try {
                const capabilities = {
                    errorTypes: [
                        'network',
                        'pathfinding',
                        'inventory',
                        'crafting',
                        'mining',
                        'movement',
                        'bot_state',
                        'timeout'
                    ],
                    actionTypes: [
                        'retry',
                        'fallback',
                        'abort',
                        'recover'
                    ],
                    features: [
                        'automatic_retry_with_backoff',
                        'intelligent_fallback_actions',
                        'error_classification',
                        'recovery_procedures',
                        'error_history_tracking',
                        'statistics_reporting'
                    ],
                    configuration: {
                        maxRetryAttempts: 3,
                        maxHistorySize: 100,
                        defaultTimeout: 30000,
                        retryDelayMultiplier: 2
                    }
                };
                return respond.ok(res, capabilities, 'Error handling capabilities retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to retrieve capabilities');
            }
        }
    };
}
