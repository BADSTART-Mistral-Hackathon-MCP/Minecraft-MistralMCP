import MinecraftBot from '../bot';
import QuestEngine from '../quest/QuestEngine';
import { getPersona } from './personas';
import { ToolCall } from './tools';

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
    // Minimal heuristic: if message contains "quest", propose a basic COLLECT quest blueprint
    const lower = message.toLowerCase();
    if (lower.includes('quête') || lower.includes('quest')) {
      const options = ['oui', 'non'];
      return {
        dmText: "Le vent murmure une mission... Acceptes-tu cette quête ? (oui/non)",
        awaitingChoice: { questId: 'pending', options, expiresAt: Date.now() + 60_000 },
        toolCalls: [ { tool: 'propose_quest', args: { playerName } } ]
      };
    }
    // Default short reply
    return { dmText: "Je t'écoute. Souhaites-tu une quête ?" };
  }
}

export default DMOrchestrator;

