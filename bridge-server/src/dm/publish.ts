import MinecraftBot from '../bot';

function escapeJson(s: string): string {
  return s.replace(/"/g, '\\"');
}

export async function sendDMWithChoices(bot: any, playerName: string, text: string, questId: string, options: string[]): Promise<void> {
  const safeText = escapeJson(text);
  const parts = options.map((opt, idx) => {
    const label = opt;
    const suggest = `##DM## q:${questId} ${opt}`;
    return `{"text":" ${idx===0?'[':''}${label}${idx===0?']':''}","color":"${idx===0?'green':'aqua'}","bold":true,"clickEvent":{"action":"suggest_command","value":"${escapeJson(suggest)}"},"hoverEvent":{"action":"show_text","value":"Clique pour choisir: ${escapeJson(label)}"}}`;
  }).join(',');

  const json = `{"text":"${safeText}","color":"yellow","extra":[${parts}]}`;

  // Try to use /tellraw (requires OP). Fallback to plain say.
  try {
    if (typeof bot.runCommand === 'function') {
      const out = await bot.runCommand(`/tellraw ${playerName} ${json}`, 1500);
      if (!out.ok && typeof bot.say === 'function') {
        bot.say(`${text} Options: ${options.map(o=>`[${o}]`).join(' ')} (ou tape: ##DM## q:${questId} <choix>)`);
      }
    } else if (typeof bot.chat === 'function') {
      bot.chat(`/tellraw ${playerName} ${json}`);
    }
  } catch {
    if (typeof bot.say === 'function') {
      bot.say(`${text} Options: ${options.map(o=>`[${o}]`).join(' ')} (ou tape: ##DM## q:${questId} <choix>)`);
    } else if (typeof bot.chat === 'function') {
      bot.chat(`${text} Options: ${options.map(o=>`[${o}]`).join(' ')} (ou tape: ##DM## q:${questId} <choix>)`);
    }
  }
}

export async function sendDMAck(bot: any, playerName: string, text: string): Promise<void> {
  try {
    if (typeof bot.runCommand === 'function') {
      await bot.runCommand(`/tellraw ${playerName} {\\\"text\\\":\\\"${escapeJson(text)}\\\",\\\"color\\\":\\\"green\\\"}`);
    } else if (typeof bot.chat === 'function') {
      bot.chat(`/tellraw ${playerName} {\\\"text\\\":\\\"${escapeJson(text)}\\\",\\\"color\\\":\\\"green\\\"}`);
    } else if (typeof bot.say === 'function') {
      bot.say(text);
    }
  } catch {
    if (typeof bot.say === 'function') bot.say(text);
    else if (typeof bot.chat === 'function') bot.chat(text);
  }
}
