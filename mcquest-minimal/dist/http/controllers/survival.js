import { respond } from '../response.js';
export function createSurvivalController(gateway) {
    return {
        // Start survival mode
        async startSurvival(req, res) {
            try {
                const result = await gateway.startSurvivalMode();
                return respond.ok(res, { result }, 'Survival mode started');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to start survival mode');
            }
        },
        // Stop survival mode
        async stopSurvival(req, res) {
            try {
                const result = gateway.stopSurvivalMode();
                return respond.ok(res, { result }, 'Survival mode stopped');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to stop survival mode');
            }
        },
        // Get survival state
        async getSurvivalState(req, res) {
            try {
                const state = gateway.getSurvivalState();
                return respond.ok(res, state, 'Survival state retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to get survival state');
            }
        },
        // Smart mining with survival logic
        async smartMining(req, res) {
            try {
                const { blockType, quantity = 10 } = req.body;
                if (!blockType || typeof blockType !== 'string') {
                    return respond.badRequest(res, 'Block type is required and must be a string');
                }
                if (typeof quantity !== 'number' || quantity < 1 || quantity > 64) {
                    return respond.badRequest(res, 'Quantity must be a number between 1 and 64');
                }
                const result = await gateway.smartMining(blockType, quantity);
                return respond.ok(res, { result }, 'Smart mining initiated');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Smart mining failed');
            }
        },
        // Execute custom mining plan
        async executeMiningPlan(req, res) {
            try {
                const { targetBlock, safeDepth = 32, lightingRequired = true, supportStructure = true, escapeRoute = true } = req.body;
                if (!targetBlock || typeof targetBlock !== 'string') {
                    return respond.badRequest(res, 'Target block is required and must be a string');
                }
                const plan = {
                    targetBlock,
                    safeDepth: Math.max(1, Math.min(safeDepth, 64)),
                    lightingRequired: Boolean(lightingRequired),
                    supportStructure: Boolean(supportStructure),
                    escapeRoute: Boolean(escapeRoute)
                };
                const result = await gateway.executeMiningPlan(plan);
                return respond.ok(res, { result, plan }, 'Mining plan executed');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Mining plan execution failed');
            }
        }
    };
}
