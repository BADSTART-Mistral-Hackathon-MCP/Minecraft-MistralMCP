import { EventEmitter } from 'events';

export const bus = new EventEmitter();

export type BusEvent =
  | 'dm_say'
  | 'quest_started'
  | 'quest_succeeded'
  | 'quest_failed'
  | 'quest_updated';

