import MinecraftBot from '../bot';
import { InMemoryQuestRepo } from '../quest/QuestRepo';
import QuestEngine from '../quest/QuestEngine';
import DMOrchestrator from '../dm/Orchestrator';

let questRepo: InMemoryQuestRepo | null = null;
let questEngine: QuestEngine | null = null;
let dm: DMOrchestrator | null = null;

export function initServices(bot: MinecraftBot) {
  if (!questRepo) questRepo = new InMemoryQuestRepo();
  if (!questEngine) questEngine = new QuestEngine(bot, questRepo);
  if (!dm) dm = new DMOrchestrator(bot, questEngine);
}

export function getQuestEngine(): QuestEngine {
  if (!questEngine) throw new Error('Services not initialized');
  return questEngine;
}

export function getDM(): DMOrchestrator {
  if (!dm) throw new Error('Services not initialized');
  return dm;
}

