import { Request, Response } from 'express';
import { BotGateway } from '../../bot/BotGateway.js';
import { respond } from '../response.js';

export function createDebugController(gateway: BotGateway) {
  return {
    // Get all players detected by the bot
    async getPlayers(req: Request, res: Response) {
      try {
        const bot = gateway.getBotInstance();
        if (!bot) {
          return respond.error(res, 'Bot not connected');
        }

        // EXTENSIVE DEBUGGING - Check ALL possible ways to detect players
        console.log('\n=== EXTENSIVE PLAYER DETECTION DEBUG ===');

        // Method 1: bot.players
        const rawPlayers = Object.keys(bot.players);
        console.log('[DEBUG] Method 1 - bot.players keys:', rawPlayers);
        console.log('[DEBUG] Bot username:', bot.username);
        console.log('[DEBUG] bot.players full object:', bot.players);

        // Method 2: bot.entities (all types)
        const allEntities = Object.values(bot.entities);
        console.log('[DEBUG] Method 2 - Total entities count:', allEntities.length);

        // Method 3: Player entities specifically
        const playerEntities = allEntities.filter(entity => entity && entity.type === 'player');
        console.log('[DEBUG] Method 3 - Player type entities:', playerEntities.length);
        playerEntities.forEach((entity, i) => {
          console.log(`[DEBUG] Player entity ${i}:`, {
            username: entity.username,
            name: entity.name,
            type: entity.type,
            id: entity.id
          });
        });

        // Method 4: All entities with usernames
        const entitiesWithUsernames = allEntities.filter(entity => entity && entity.username);
        console.log('[DEBUG] Method 4 - Entities with usernames:', entitiesWithUsernames.length);
        entitiesWithUsernames.forEach((entity, i) => {
          console.log(`[DEBUG] Username entity ${i}:`, {
            username: entity.username,
            name: entity.name,
            type: entity.type,
            id: entity.id
          });
        });

        // Method 5: Check if bot has playerJoined/playerLeft events data
        console.log('[DEBUG] Method 5 - Bot game info:', {
          gameMode: bot.game?.gameMode,
          difficulty: bot.game?.difficulty,
          dimension: bot.game?.dimension
        });

        // Method 6: Try bot.nearestEntity
        try {
          const nearestPlayer = bot.nearestEntity(entity =>
            entity.type === 'player' && entity.username !== bot.username
          );
          console.log('[DEBUG] Method 6 - Nearest player entity:', nearestPlayer ? {
            username: nearestPlayer.username,
            distance: bot.entity.position.distanceTo(nearestPlayer.position)
          } : 'none');
        } catch (e) {
          console.log('[DEBUG] Method 6 - nearestEntity failed:', e instanceof Error ? e.message : String(e));
        }

        console.log('=== END DEBUG ===\n');

        const players = Object.entries(bot.players).map(([name, player]) => ({
          name,
          uuid: player.uuid,
          hasEntity: !!player.entity,
          position: player.entity ? {
            x: player.entity.position.x,
            y: player.entity.position.y,
            z: player.entity.position.z
          } : null,
          distance: player.entity ?
            bot.entity.position.distanceTo(player.entity.position) : null
        }));

        return respond.ok(res, {
          totalPlayers: players.length,
          botUsername: bot.username,
          rawPlayerKeys: rawPlayers,
          players,
          playerEntities: playerEntities.map(e => ({
            username: e.username,
            name: e.name,
            type: e.type,
            id: e.id,
            position: {
              x: e.position.x,
              y: e.position.y,
              z: e.position.z
            }
          })),
          entitiesWithUsernames: entitiesWithUsernames.map(e => ({
            username: e.username,
            name: e.name,
            type: e.type,
            id: e.id
          })),
          totalEntities: allEntities.length
        }, 'Players list retrieved');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to get players');
      }
    },

    // Get all entities around the bot
    async getEntities(req: Request, res: Response) {
      try {
        const bot = gateway.getBotInstance();
        if (!bot) {
          return respond.error(res, 'Bot not connected');
        }

        const entities = Object.values(bot.entities)
          .filter(entity => entity && entity !== bot.entity)
          .map(entity => ({
            id: entity.id,
            name: entity.name,
            type: entity.type,
            username: entity.username,
            position: {
              x: entity.position.x,
              y: entity.position.y,
              z: entity.position.z
            },
            distance: bot.entity.position.distanceTo(entity.position)
          }))
          .sort((a, b) => a.distance - b.distance);

        return respond.ok(res, {
          totalEntities: entities.length,
          entities: entities.slice(0, 20) // Limit to 20 closest
        }, 'Entities list retrieved');
      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to get entities');
      }
    },

    // Force refresh player list
    async refreshPlayers(req: Request, res: Response) {
      try {
        const bot = gateway.getBotInstance();
        if (!bot) {
          return respond.error(res, 'Bot not connected');
        }

        // Force a player list refresh by sending a tab list request
        bot.chat('/list'); // This will help refresh the player list

        // Wait a bit then return updated list
        setTimeout(() => {
          const players = Object.keys(bot.players);
          respond.ok(res, {
            refreshed: true,
            playerCount: players.length,
            players: players.filter(name => name !== bot.username)
          }, 'Player list refreshed');
        }, 1000);

      } catch (error) {
        return respond.error(res, error instanceof Error ? error.message : 'Failed to refresh players');
      }
    }
  };
}