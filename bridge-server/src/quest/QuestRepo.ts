import { QuestInstance } from '../types/quest';

export interface QuestRepo {
  save(q: QuestInstance): Promise<void>;
  get(id: string): Promise<QuestInstance | undefined>;
  list(): Promise<QuestInstance[]>;
}

export class InMemoryQuestRepo implements QuestRepo {
  private store = new Map<string, QuestInstance>();

  async save(q: QuestInstance): Promise<void> {
    this.store.set(q.id, { ...q });
  }

  async get(id: string): Promise<QuestInstance | undefined> {
    const q = this.store.get(id);
    return q ? { ...q } : undefined;
  }

  async list(): Promise<QuestInstance[]> {
    return Array.from(this.store.values()).map(v => ({ ...v }));
  }
}

