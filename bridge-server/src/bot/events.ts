import mineflayer from 'mineflayer';
import { Movements } from 'mineflayer-pathfinder';

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

    // Death event
    bot.on('death', () => {
        console.log('💀 Bot died! Respawning...');
        bot.respawn();
    });
}