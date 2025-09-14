import MinecraftBot from '../bot';

export interface PlanksQuestStatus {
  active: boolean;
  completed: boolean;
  startTime?: number;
  baselineCount?: number;
  currentCount?: number;
  gained?: number;
  target: number;
  rewardPlayer?: string;
}

/**
 * Simple quest service that watches the bot inventory
 * and completes when the bot has gained N wooden planks
 * since the quest start.
 */
export class PlanksQuestService {
  private bot: MinecraftBot;
  private active = false;
  private completed = false;
  private startTime = 0;
  private baselineCount = 0;
  private target = 8;
  private timer: NodeJS.Timeout | null = null;
  private crafting = false;
  private assistCrafting = true;
  private rewardPlayerName: string | null = null;
  private rewardGiven = false;

  constructor(bot: MinecraftBot) {
    this.bot = bot;
  }

  public start(target = 8, assistCrafting = true, rewardPlayerName?: string): PlanksQuestStatus {
    if (!this.bot.isReady()) {
      throw new Error('Bot is not connected or ready');
    }

    // If already active, return current status
    if (this.active && !this.completed) {
      return this.status();
    }

    this.target = Math.max(1, Math.floor(target));
    this.assistCrafting = assistCrafting;
    this.rewardPlayerName = rewardPlayerName || null;
    this.baselineCount = this.countPlanks();
    this.startTime = Date.now();
    this.completed = false;
    this.active = true;
    this.rewardGiven = false;

    try { this.bot.say('tu doit me fournir 8 item de planches de bois'); } catch {}

    this.startLoop();

    return this.status();
  }

  public stop(): PlanksQuestStatus {
    this.clearLoop();
    this.active = false;
    this.completed = false;
    return this.status();
  }

  public status(): PlanksQuestStatus {
    const current = this.countPlanks();
    const gained = Math.max(0, current - this.baselineCount);
    return {
      active: this.active,
      completed: this.completed,
      startTime: this.startTime || undefined,
      baselineCount: this.active ? this.baselineCount : undefined,
      currentCount: current,
      gained,
      target: this.target,
      rewardPlayer: this.rewardPlayerName || undefined,
    };
  }

  private startLoop(): void {
    this.clearLoop();
    // Poll inventory regularly; keep logic simple and robust
    this.timer = setInterval(async () => {
      if (!this.active) return;
      if (!this.bot.isReady()) return; // wait until bot comes back

      const current = this.countPlanks();
      const gained = Math.max(0, current - this.baselineCount);

      if (gained >= this.target) {
        this.complete();
        return;
      }

      // Optional assist: try to craft planks from logs if possible
      if (this.assistCrafting && !this.crafting) {
        try {
          await this.tryAutoCraftPlanks(this.target - gained);
        } catch {
          // ignore crafting errors in background
        }
      }
    }, 1500);
  }

  private clearLoop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private complete(): void {
    this.completed = true;
    this.active = false;
    this.clearLoop();
    try { this.bot.say('Bravo'); } catch {}
    // Attempt reward via server command if player specified (requires OP)
    if (this.rewardPlayerName && !this.rewardGiven) {
      (async () => {
        try {
          const ok = await this.bot.giveEmeralds(this.rewardPlayerName!, 10);
          if (!ok) {
            try { this.bot.say("Échec de la récompense: vérifiez les permissions OP et que le joueur est en ligne."); } catch {}
          }
          this.rewardGiven = ok;
        } catch {
          try { this.bot.say("Échec de la récompense: erreur d'exécution de la commande."); } catch {}
        }
      })();
    }

    // Consume only the quest planks (do not exceed what was gained since start)
    (async () => {
      try {
        const current = this.countPlanks();
        const gained = Math.max(0, current - this.baselineCount);
        const toRemove = Math.max(0, Math.min(this.target, gained));
        if (toRemove > 0) {
          const removed = await this.bot.removePlanks(toRemove);
          if (removed < toRemove) {
            try { this.bot.say(`Suppression incomplète des items de quête (${removed}/${toRemove}).`); } catch {}
          }
        }
      } catch {
        try { this.bot.say('Impossible de supprimer les items de quête.'); } catch {}
      }
    })();
  }

  private countPlanks(): number {
    try {
      const items = this.bot.getInventory();
      let total = 0;
      for (const it of items) {
        const name = (it.name || '').toLowerCase();
        const dname = (it.displayName || '').toLowerCase();
        if (name.includes('planks') || dname.includes('plank')) {
          total += it.count || 0;
        }
      }
      return total;
    } catch {
      return 0;
    }
  }

  private countLogs(): { type: string; count: number }[] {
    const logs = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'pale_oak'];
    const inv = this.bot.getInventory();
    const found: { type: string; count: number }[] = [];
    for (const t of logs) {
      const k1 = `${t}_log`;
      const k2 = `${t}_wood`;
      const cnt = inv.filter(i => i.name === k1 || i.name === k2).reduce((s, i) => s + (i.count || 0), 0);
      if (cnt > 0) found.push({ type: t, count: cnt });
    }
    return found;
  }

  private async tryAutoCraftPlanks(missing: number): Promise<void> {
    if (missing <= 0) return;
    this.crafting = true;
    try {
      // Find any available logs and craft corresponding planks
      const logs = this.countLogs();
      for (const l of logs) {
        if (missing <= 0) break;
        const itemName = `${l.type}_planks`;
        // Each log gives 4 planks; try crafting floor(missing/4) or at least 1
        const craftable = Math.max(1, Math.floor(missing));
        try {
          // Mineflayer craft will cap to available materials via recipe
          await this.bot.craft(itemName, craftable);
        } catch {
          // ignore and try next wood type
        }
        // Recompute missing after attempt
        const current = this.countPlanks();
        const gained = Math.max(0, current - this.baselineCount);
        missing = this.target - gained;
      }
    } finally {
      this.crafting = false;
    }
  }
}

export default PlanksQuestService;
