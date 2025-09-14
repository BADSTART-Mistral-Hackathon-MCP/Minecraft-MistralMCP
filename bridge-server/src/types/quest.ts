export type QuestState = 'idle'|'offering'|'awaiting_choice'|'running'|'paused'|'success'|'failure';

export type ObjectiveType = 'COLLECT'|'KILL'|'GO_TO'|'INTERACT'|'ESCORT';
export type ConditionType = 'TIMER'|'DEATH'|'LEAVE_AREA'|'LOST_KEY_ITEM'|'CUSTOM';

export interface Objective {
  id: string;
  type: ObjectiveType;
  params: Record<string, any>; // ex: { item:"minecraft:oak_planks", count:8 }
  progress?: number; // 0..target
  target?: number;
  completed?: boolean;
}

export interface Condition {
  id: string;
  type: ConditionType;
  params: Record<string, any>; // ex: { seconds:900 } pour TIMER
}

export interface Reward {
  commands?: string[]; // /give, /effect...
  items?: Array<{ itemId: string; count: number; enchants?: Array<{id:string;level:number}> }>;
  xp?: number;
}

export interface QuestBlueprint {
  id?: string;
  title: string;
  synopsis: string;
  personaTag?: string; // "sarcastic", "wise_cat", etc.
  seed: string;       // pour reproductibilité
  biomeBias?: string[];
  objectives: Objective[];
  successConditions?: Condition[];
  failureConditions?: Condition[];
  reward: Reward;
  flavorLines?: { start?: string; success?: string[]; failure?: string[] };
  noveltySignature: string; // voir §4
}

export interface QuestInstance extends QuestBlueprint {
  id: string;
  playerName: string;
  state: QuestState;
  startedAt?: number;
  timers?: Record<string, NodeJS.Timeout>;
  runtime: {
    awaitingChoice?: { prompt: string; options: string[]; expiresAt?: number };
    worldAnchor?: { x: number; y: number; z: number; radius: number };
    counters?: Record<string, number>;
  };
}

