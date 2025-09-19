import { Request, Response } from 'express';
import { BotGateway } from '../../bot/BotGateway.js';
import { respond } from '../response.js';

export function createCombatController(gateway: BotGateway) {
  return {
    // Enable combat mode
    async enableCombat(req: Request, res: Response) {
      try {
        const settings = req.body.settings || {};

        // Validate settings
        if (settings.maxAttackDistance !== undefined) {
          if (typeof settings.maxAttackDistance !== 'number' || settings.maxAttackDistance < 1 || settings.maxAttackDistance > 10) {
            return respond.badRequest(res, 'Max attack distance must be between 1 and 10');
          }
        }

        if (settings.healthThreshold !== undefined) {
          if (typeof settings.healthThreshold !== 'number' || settings.healthThreshold < 1 || settings.healthThreshold > 20) {
            return respond.badRequest(res, 'Health threshold must be between 1 and 20');
          }
        }

        const result = gateway.enableCombatMode(settings);
        return respond.ok(res, { result, settings }, 'Combat mode enabled');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to enable combat mode');
      }
    },

    // Disable combat mode
    async disableCombat(req: Request, res: Response) {
      try {
        const result = gateway.disableCombatMode();
        return respond.ok(res, { result }, 'Combat mode disabled');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to disable combat mode');
      }
    },

    // Enable aggressive mode
    async enableAggressiveMode(req: Request, res: Response) {
      try {
        const { targetPlayer } = req.body;

        if (targetPlayer && typeof targetPlayer !== 'string') {
          return respond.badRequest(res, 'Target player must be a string');
        }

        const result = gateway.enableAggressiveMode(targetPlayer);
        return respond.ok(res, { result, targetPlayer }, 'Aggressive mode enabled');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to enable aggressive mode');
      }
    },

    // Enable retaliation mode
    async enableRetaliationMode(req: Request, res: Response) {
      try {
        const result = gateway.enableRetaliationMode();
        return respond.ok(res, { result }, 'Retaliation mode enabled');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to enable retaliation mode');
      }
    },

    // Attack specific player
    async attackPlayer(req: Request, res: Response) {
      try {
        const { playerName } = req.body;

        if (!playerName || typeof playerName !== 'string') {
          return respond.badRequest(res, 'Player name is required and must be a string');
        }

        const result = gateway.attackPlayer(playerName);
        return respond.ok(res, { result, targetPlayer: playerName }, 'Attack initiated');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Attack failed');
      }
    },

    // Get combat status
    async getCombatStatus(req: Request, res: Response) {
      try {
        const status = gateway.getCombatStatus();
        return respond.ok(res, status, 'Combat status retrieved');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to get combat status');
      }
    },

    // Update combat settings
    async updateCombatSettings(req: Request, res: Response) {
      try {
        const settings = req.body;

        if (!settings || typeof settings !== 'object') {
          return respond.badRequest(res, 'Settings object is required');
        }

        // Validate specific settings
        if (settings.maxAttackDistance !== undefined) {
          if (typeof settings.maxAttackDistance !== 'number' || settings.maxAttackDistance < 1 || settings.maxAttackDistance > 10) {
            return respond.badRequest(res, 'Max attack distance must be between 1 and 10');
          }
        }

        if (settings.healthThreshold !== undefined) {
          if (typeof settings.healthThreshold !== 'number' || settings.healthThreshold < 1 || settings.healthThreshold > 20) {
            return respond.badRequest(res, 'Health threshold must be between 1 and 20');
          }
        }

        const result = gateway.updateCombatSettings(settings);
        return respond.ok(res, { result, settings }, 'Combat settings updated');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to update combat settings');
      }
    },

    // Clear recent attackers
    async clearAttackers(req: Request, res: Response) {
      try {
        const result = gateway.clearRecentAttackers();
        return respond.ok(res, { result }, 'Recent attackers cleared');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to clear attackers');
      }
    }
  };
}