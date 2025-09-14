import MinecraftBot from '../bot';
import QuestEngine from '../quest/QuestEngine';
import { getPersona } from './personas';
import { ToolCall } from './tools';
import crypto from 'crypto';
import { sendDMWithChoices } from './publish';

export interface DMChatInput { playerName: string; message: string }

export interface DMChatOutput {
  dmText: string;
  awaitingChoice?: { questId: string; options: string[]; expiresAt?: number };
  toolCalls?: ToolCall[];
}

export class DMOrchestrator {
  constructor(private bot: MinecraftBot, private engine: QuestEngine) {}

  async buildContext(playerName: string) {
    const status = this.bot.getStatus();
    const pos = this.bot.isReady() ? this.bot.getPosition() : null;
    const internal = this.bot.getInternalBot?.();
    const players = internal ? Object.values(internal.players).filter(p => p && p.username).map(p => p!.username) : [];
    return {
      time: Date.now(),
      health: status.health,
      food: status.food,
      pos,
      playersNearby: players,
      persona: getPersona(),
    };
  }

  async onPlayerChat(playerName: string, message: string): Promise<DMChatOutput> {
    const lower = message.toLowerCase();
    // If player asks for a quest, propose and publish clickable options
    if (lower.includes('quête') || lower.includes('quest')) {
      const bp = {
        title: 'Collecte de ressources',
        synopsis: 'Aide le village en rassemblant des planches.',
        seed: `${playerName}-${Date.now()}`,
        objectives: [ { id:'o1', type:'COLLECT', params:{ item:'minecraft:oak_planks', count:8 }, target: 8 } ],
        failureConditions: [ { id:'f1', type:'TIMER', params:{ seconds:900 } } ],
        reward: { items: [ { itemId:'minecraft:emerald', count: 10 } ] },
        noveltySignature: crypto.createHash('sha1').update(`COLLECT:oak_planks:${playerName}`).digest('hex')
      } as any;
      const quest = await this.engine.instantiate(bp, playerName);
      const dmText = "Le vent murmure une mission... Acceptes-tu cette quête ?";
      const options = ['oui','non'];
      await sendDMWithChoices(this.bot, playerName, dmText, quest.id, options);
      return {
        dmText,
        awaitingChoice: { questId: quest.id, options, expiresAt: Date.now() + 60_000 },
        toolCalls: [ { tool: 'start_quest', args: { questId: quest.id } } ]
      };
    }
    // Default short reply (no publishing)
    return { dmText: "Je t'écoute. Souhaites-tu une quête ?" };
  }
}

export default DMOrchestrator;

