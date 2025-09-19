import { respond } from '../response.js';
export function createPathfindingController(gateway) {
    return {
        // Enhanced pathfinding with custom options
        async findEnhancedPath(req, res) {
            try {
                const { x, y, z, options = {} } = req.body;
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
                    return respond.badRequest(res, 'Invalid coordinates. x, y, z must be numbers');
                }
                const result = await gateway.findEnhancedPath({ x, y, z }, options);
                return respond.ok(res, result, 'Enhanced pathfinding completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Enhanced pathfinding failed');
            }
        },
        // Find a safe path to target
        async findSafePath(req, res) {
            try {
                const { x, y, z } = req.body;
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
                    return respond.badRequest(res, 'Invalid coordinates. x, y, z must be numbers');
                }
                const result = await gateway.findSafePath({ x, y, z });
                return respond.ok(res, result, 'Safe pathfinding completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Safe pathfinding failed');
            }
        },
        // Find the fastest path to target
        async findFastPath(req, res) {
            try {
                const { x, y, z } = req.body;
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
                    return respond.badRequest(res, 'Invalid coordinates. x, y, z must be numbers');
                }
                const result = await gateway.findFastPath({ x, y, z });
                return respond.ok(res, result, 'Fast pathfinding completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Fast pathfinding failed');
            }
        },
        // Find multiple alternative paths
        async findAlternativePaths(req, res) {
            try {
                const { x, y, z, count = 3 } = req.body;
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
                    return respond.badRequest(res, 'Invalid coordinates. x, y, z must be numbers');
                }
                if (typeof count !== 'number' || count < 1 || count > 10) {
                    return respond.badRequest(res, 'Count must be a number between 1 and 10');
                }
                const results = await gateway.findAlternativePaths({ x, y, z }, count);
                return respond.ok(res, {
                    alternatives: results,
                    count: results.length,
                    successful: results.filter(r => r.success).length
                }, 'Alternative paths found');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Alternative pathfinding failed');
            }
        },
        // Find path to nearest block of specified type
        async findPathToNearestBlock(req, res) {
            try {
                const { blockType, maxDistance = 64 } = req.body;
                if (!blockType || typeof blockType !== 'string') {
                    return respond.badRequest(res, 'Block type is required and must be a string');
                }
                if (typeof maxDistance !== 'number' || maxDistance < 1 || maxDistance > 256) {
                    return respond.badRequest(res, 'Max distance must be a number between 1 and 256');
                }
                const result = await gateway.findPathToNearestBlock(blockType, maxDistance);
                return respond.ok(res, result, `Path to nearest ${blockType} found`);
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Block pathfinding failed');
            }
        },
        // Find path to specific player
        async findPathToPlayer(req, res) {
            try {
                const { playerName } = req.body;
                if (!playerName || typeof playerName !== 'string') {
                    return respond.badRequest(res, 'Player name is required and must be a string');
                }
                const result = await gateway.findPathToPlayer(playerName);
                return respond.ok(res, result, `Path to player ${playerName} found`);
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Player pathfinding failed');
            }
        },
        // Find path to a safe location
        async findPathToSafeLocation(req, res) {
            try {
                const result = await gateway.findPathToSafeLocation();
                return respond.ok(res, result, 'Path to safe location found');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Safe location pathfinding failed');
            }
        },
        // Enhanced movement with safety options
        async moveToEnhanced(req, res) {
            try {
                const { x, y, z, safe = false } = req.body;
                if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
                    return respond.badRequest(res, 'Invalid coordinates. x, y, z must be numbers');
                }
                const result = await gateway.moveToEnhanced(x, y, z, safe);
                return respond.ok(res, { result }, 'Enhanced movement completed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Enhanced movement failed');
            }
        }
    };
}
