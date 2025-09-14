import MinecraftBot from '../bot';

export interface SimpleQuestStatus {
  active: boolean;
  startedAt?: number;
  required: number;
  currentGold?: number;
}

/**
 * Extremely simple quest: ask for 8 gold ingots.
 * - On start: says a medieval-style start line.
 * - Every 10 seconds: if inventory has < 8 gold ingots, repeats a reminder.
 * - When inventory has >= 8 gold ingots: announces completion and stops.
 */
export class SimpleGoldQuestService {
  private readonly required = 8;
  private readonly intervalMs = 10_000;
  private timer: NodeJS.Timeout | null = null;
  private startedAt: number | null = null;
  private active = false;

  constructor(private bot: MinecraftBot) {}

  public start(): SimpleQuestStatus {
    if (!this.bot.isReady()) {
      throw new Error('Bot is not connected or ready');
    }

    if (this.active) {
      return this.status();
    }

    this.active = true;
    this.startedAt = Date.now();

    try {
      this.bot.say("Oyez ! La quête a commencé: apporte-moi 8 lingots d'or.");
    } catch {}

    this.beginLoop();
    return this.status();
  }

  private beginLoop(): void {
    this.clearLoop();
    this.timer = setInterval(() => {
      if (!this.active) return;
      if (!this.bot.isReady()) return;

      const have = this.countGoldIngots();
      if (have >= this.required) {
        this.complete();
        return;
      }

      try { this.bot.say('ramene mon or esclaves'); } catch {}
    }, this.intervalMs);
  }

  private clearLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private complete(): void {
    this.active = false;
    this.clearLoop();
    try { this.bot.say("Bien. La quête est terminée."); } catch {}
  }

  private countGoldIngots(): number {
    try {
      const items = this.bot.getInventory();
      return items.filter(i => i.name === 'gold_ingot').reduce((s, it) => s + (it.count || 0), 0);
    } catch {
      return 0;
    }
  }

  public status(): SimpleQuestStatus {
    return {
      active: this.active,
      startedAt: this.startedAt || undefined,
      required: this.required,
      currentGold: this.countGoldIngots(),
    };
  }

  public stop(): SimpleQuestStatus {
    this.active = false;
    this.clearLoop();
    return this.status();
  }
}

export default SimpleGoldQuestService;

