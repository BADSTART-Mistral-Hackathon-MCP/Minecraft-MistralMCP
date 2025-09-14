export type Persona = 'wise_cat' | 'sarcastic' | 'heroic';

export interface PersonaConfig {
  persona: Persona;
  temperature: number;
}

let current: PersonaConfig = { persona: 'wise_cat', temperature: 0.5 };

export function setPersona(p: Persona, temperature?: number) {
  current = { persona: p, temperature: typeof temperature === 'number' ? temperature : current.temperature };
}

export function getPersona(): PersonaConfig {
  return current;
}

