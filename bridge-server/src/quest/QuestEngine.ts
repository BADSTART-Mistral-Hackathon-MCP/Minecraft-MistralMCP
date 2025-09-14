import { EventEmitter } from 'events';
import MinecraftBot from '../bot';
import { QuestBlueprint, QuestInstance, QuestState, Objective } from '../types/quest';
import { QuestRepo } from './QuestRepo';
import { bus } from '../services/bus';

export class QuestEngine {
  private quests = new Map<string, QuestInstance>();

  constructor(private bot: MinecraftBot, private repo: QuestRepo, private emitter: EventEmitter = bus) {}

  get(id: string): QuestInstance | undefined { return this.quests.get(id); }
  getActiveFor(playerName: string): QuestInstance | undefined {
    return Array.from(this.quests.values()).find(q => q.playerName === playerName && q.state === 'running');
  }

  async instantiate(bp: QuestBlueprint, playerName: string): Promise<QuestInstance> {
    const id = bp.id ?? `q_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const q: QuestInstance = { ...bp, id, playerName, state: 'offering', runtime: {} };
    this.quests.set(q.id, q);
    await this.repo.save(q);
    return q;
  }

  async start(id: string) {
    const q = this.mustGet(id);
    q.state = 'running';
    q.startedAt = Date.now();
    this.attachWatchers(q);
    await this.repo.save(q);
    this.emitter.emit('quest_started', { id: q.id, playerName: q.playerName });
    console.log(`Quest ${q.id} started for player ${q.playerName}`);
  }

  async accept(id: string) {
    const q = this.mustGet(id);
    if (q.state === 'offering' || q.state === 'awaiting_choice') {
      q.state = 'running';
      q.startedAt = Date.now();
      this.attachWatchers(q);
      await this.repo.save(q);
      this.emitter.emit('quest_started', { id: q.id, playerName: q.playerName });
      console.log(`Quest ${q.id} accepted by player ${q.playerName}`);
    }
  }

  async decline(id: string) {
    const q = this.mustGet(id);
    q.state = 'failure';
    await this.repo.save(q);
    this.cleanup(q);
    this.emitter.emit('quest_failed', { id: q.id, reason: 'declined' });
    console.log(`Quest ${q.id} declined by player ${q.playerName}`);
  }

  async branch(id: string, choice: string) {
    const q = this.mustGet(id);
    q.runtime.counters = q.runtime.counters || {};
    q.runtime.counters['branch'] = choice.length;
    await this.repo.save(q);
    this.emitter.emit('quest_updated', { id: q.id, branch: choice });
    console.log(`Quest ${q.id} branched to ${choice} by player ${q.playerName}`);
  }

  async setTimer(id: string, seconds: number, label?: string) {
    const q = this.mustGet(id);
    const ms = Math.max(1, Math.floor(seconds)) * 1000;
    q.runtime.counters = q.runtime.counters || {};
    q.runtime.counters['deadline'] = Date.now() + ms;
    q.timers = q.timers || {};
    if (q.timers['TIMER']) clearTimeout(q.timers['TIMER']);
    q.timers['TIMER'] = setTimeout(() => this.fail(q.id, 'timer'), ms);
    await this.repo.save(q);
    this.emitter.emit('quest_updated', { id: q.id, timer: { seconds, label } });
    console.log(`Quest ${q.id} timer set to ${seconds}s by player ${q.playerName}`);
  }

  async succeed(id: string) {
    const q = this.mustGet(id);
    q.state = 'success';
    await this.repo.save(q);
    this.cleanup(q);
    this.emitter.emit('quest_succeeded', { id: q.id });
    console.log(`Quest ${q.id} succeeded for player ${q.playerName}`);
  }

  async fail(id: string, reason: string) {
    const q = this.mustGet(id);
    q.state = 'failure';
    await this.repo.save(q);
    this.cleanup(q);
    this.emitter.emit('quest_failed', { id: q.id, reason });
    console.log(`Quest ${q.id} failed for player ${q.playerName}: ${reason}`);
  }

  private attachWatchers(q: QuestInstance) {
    // TIMER
    const t = q.failureConditions?.find(c => c.type === 'TIMER');
    if (t) {
      const ms = (t.params.seconds ?? 0) * 1000;
      q.runtime.counters = q.runtime.counters || {};
      q.runtime.counters['deadline'] = Date.now() + ms;
      q.timers = q.timers || {};
      q.timers['TIMER'] = setTimeout(() => this.fail(q.id, 'timer'), ms);
    }

    // COLLECT polling (basic example)
    const collect = (q.objectives || []).filter(o => o.type === 'COLLECT');
    if (collect.length > 0) {
      const int = setInterval(() => {
        try {
          const inv = this.bot.getInventory();
          for (const o of collect) {
            const itemId = (o.params?.item as string || '').replace('minecraft:', '');
            const total = inv.filter(i => i.name === itemId).reduce((s, it) => s + (it.count || 0), 0);
            o.target = o.target ?? (o.params?.count ?? 1);
            o.progress = total;
            o.completed = total >= (o.target || 1);
            // Update quest state in repo
            console.log(`Quest ${q.id} COLLECT check: have ${total} of ${itemId}, need ${o.target}`);
          }
          if (collect.every(x => x.completed)) {
            this.succeed(q.id);
          }
        } catch {}
      }, 2000);
      q.timers = q.timers || {};
      q.timers['COLLECT'] = int as unknown as NodeJS.Timeout;
      console.log(`Quest ${q.id} COLLECT watcher started for player ${q.playerName}`);
    }
  }

  private cleanup(q: QuestInstance) {
    if (q.timers) {
      for (const k of Object.keys(q.timers)) {
        clearTimeout(q.timers[k]);
      }
      q.timers = {};
      console.log(`Quest ${q.id} timers cleared for player ${q.playerName}`);
    }
  }

  private mustGet(id: string): QuestInstance {
    const q = this.quests.get(id);
    if (!q) throw new Error('Quest not found');
    console.log(`Quest ${q.id} retrieved for player ${q.playerName}`);
    return q;
  }
}

export default QuestEngine;

