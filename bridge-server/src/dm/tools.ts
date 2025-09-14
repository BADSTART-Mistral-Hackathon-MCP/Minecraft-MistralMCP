export type ToolName =
  | 'propose_quest'
  | 'start_quest'
  | 'branch_quest'
  | 'set_timer'
  | 'grant_reward'
  | 'spawn_encounter'
  | 'apply_effect'
  | 'dm_say';

export interface ToolCall { tool: ToolName; args: any }

export const TOOL_WHITELIST: ToolName[] = [
  'propose_quest','start_quest','branch_quest','set_timer','grant_reward','spawn_encounter','apply_effect','dm_say'
];

export function validateToolCalls(calls: ToolCall[]): { ok: boolean; error?: string } {
  for (const c of calls) {
    if (!TOOL_WHITELIST.includes(c.tool)) {
      return { ok: false, error: `Tool not allowed: ${c.tool}` };
    }
    if (typeof c.args !== 'object') {
      return { ok: false, error: `Invalid args for tool: ${c.tool}` };
    }
  }
  return { ok: true };
}

