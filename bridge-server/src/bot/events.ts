import mineflayer from 'mineflayer';
import { Movements } from 'mineflayer-pathfinder';
import { getQuestEngine } from '../services/registry';
import { sendDMAck } from '../dm/publish';

export function setupBotEvents(bot: mineflayer.Bot) {
    bot.once('spawn', () => {
        console.log('✅ Bot spawned successfully!');

        // Initialize pathfinder movements
        const defaultMove = new Movements(bot);
        bot.pathfinder.setMovements(defaultMove);

        console.log(`📊 Health: ${bot.health}, Food: ${bot.food}`);
        console.log(`📍 Position: (${bot.entity.position.x.toFixed(1)}, ${bot.entity.position.y.toFixed(1)}, ${bot.entity.position.z.toFixed(1)})`);
    });

    // Health monitoring
    bot.on('health', () => {
        if (bot.health <= 0) {
            console.log('💀 Bot is dead!');
            return;
        }

        console.log(`❤️ Health: ${bot.health}/20, Food: ${bot.food}/20`);

        // Auto-eat if food is low
        if (bot.food < 19) {
            const food = bot.inventory.items().find(item =>
                item.name.includes('bread') ||
                item.name.includes('apple') ||
                item.name.includes('carrot') ||
                item.name.includes('potato') ||
                item.name.includes('beef') ||
                item.name.includes('pork') ||
                item.name.includes('chicken')
            );

            if (food) {
                console.log(`🍖 Bot is hungry, eating ${food.name}...`);
                bot.equip(food, 'hand').then(() => {
                    bot.consume().catch((err) => {
                        console.error(`❌ Failed to eat: ${err.message}`);
                    });
                }).catch((err) => {
                    console.error(`❌ Failed to equip food: ${err.message}`);
                });
            }
        }
    });

    // Pathfinder events
    bot.on('goal_reached', () => {
        console.log('🎯 Bot reached its goal!');
    });

    bot.on('path_update', (r: { status: string }) => {
        switch (r.status) {
            case 'noPath':
                console.log('🚫 Bot could not find a path to the goal');
                break;
            case 'success':
                console.log('✅ Bot found a path to the goal');
                break;
            case 'partialPath':
                console.log('⚠️ Bot found a partial path to the goal');
                break;
            case 'timeout':
                console.log('⏰ Pathfinding timed out');
                break;
        }
    });

    // Player events
    bot.on('playerJoined', (player) => {
        console.log(`👋 Player joined: ${player.username}`);
    });

    bot.on('playerLeft', (player) => {
        console.log(`👋 Player left: ${player.username}`);
    });

    // Chat selection handler: players can send "##DM## q:<id> <option>"
    bot.on('chat', async (username, message) => {
        try {
            if (!username || username === bot.username) return;
            const text = message?.toString?.() || String(message || '');
            const match = text.match(/^##DM##\s+q:([^\s]+)\s+(.+)$/i);
            if (!match) return;
            const questId = match[1];
            const option = match[2].trim().toLowerCase();
            const engine = getQuestEngine();
            if (option === 'oui' || option === 'yes') {
                await engine.accept(questId);
                await sendDMAck((bot as any).mcBot || (bot as any), username, 'Quête acceptée. Bonne chance !');
            } else if (option === 'non' || option === 'no') {
                await engine.decline(questId);
                await sendDMAck((bot as any).mcBot || (bot as any), username, 'Quête refusée. Une autre fois peut-être.');
            } else {
                await engine.branch(questId, option);
                await sendDMAck((bot as any).mcBot || (bot as any), username, `Choix enregistré: ${option}`);
            }
        } catch (e) {
            console.error('DM choice handling failed:', e);
        }
    });

    // Death event
    bot.on('death', () => {
        console.log('💀 Bot died! Respawning...');
        bot.respawn();
    });
}
