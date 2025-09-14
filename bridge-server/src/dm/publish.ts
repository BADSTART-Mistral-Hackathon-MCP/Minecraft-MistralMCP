import MinecraftBot from '../bot';

function escapeJson(s: string): string {
  return s.replace(/"/g, '\\"');
}

export async function sendDMWithChoices(bot: MinecraftBot, playerName: string, text: string, questId: string, options: string[]): Promise<void> {
  const safeText = escapeJson(text);
  const parts = options.map((opt, idx) => {
    const label = opt;
    const suggest = `##DM## q:${questId} ${opt}`;
    return `{"text":" ${idx===0?'[':''}${label}${idx===0?']':''}","color":"${idx===0?'green':'aqua'}","bold":true,"clickEvent":{"action":"suggest_command","value":"${escapeJson(suggest)}"},"hoverEvent":{"action":"show_text","value":"Clique pour choisir: ${escapeJson(label)}"}}`;
  }).join(',');

  const json = `{"text":"${safeText}","color":"yellow","extra":[${parts}]}`;

  // Try to use /tellraw (requires OP). Fallback to plain say.
  try {
    const out = await bot.runCommand(`/tellraw ${playerName} ${json}`, 1500);
    if (!out.ok) {
      // Fallback
      bot.say(`${text} Options: ${options.map(o=>`[${o}]`).join(' ')} (ou tape: ##DM## q:${questId} <choix>)`);
    }
  } catch {
    bot.say(`${text} Options: ${options.map(o=>`[${o}]`).join(' ')} (ou tape: ##DM## q:${questId} <choix>)`);
  }
}

export async function sendDMAck(bot: MinecraftBot, playerName: string, text: string): Promise<void> {
  try { await bot.runCommand(`/tellraw ${playerName} {\"text\":\"${escapeJson(text)}\",\"color\":\"green\"}`); } catch { bot.say(text); }
}

