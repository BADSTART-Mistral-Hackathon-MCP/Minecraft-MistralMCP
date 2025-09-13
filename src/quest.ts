import { bot } from "./bot";


export type QuestFunction = () => Promise<string>;

export const quests: Record<string, QuestFunction> = {

    mineWood: async () => {
        const logBlock = bot.findBlock({
            matching: (block) => block.name.includes('log'),
            maxDistance: 32,
        });

        if (!logBlock) return "Aucun arbre trouvé à proximité";

        return new Promise<string>((resolve) => {
            // Access GoalBlock through bot.pathfinder
            const GoalBlock = (bot.pathfinder as any).GoalBlock;
            const goal = new GoalBlock(logBlock.position.x, logBlock.position.y, logBlock.position.z);
            bot.pathfinder.setGoal(goal);

            const timeout = setTimeout(() => {
                bot.removeListener('goal_reached', listener);
                resolve("Timeout - arbre inaccessible");
            }, 20000);

            const listener = async () => {
                clearTimeout(timeout);
                bot.removeListener('goal_reached', listener);

                try {
                    const axe = bot.inventory.items().find((item) =>
                        item.name.includes('axe') && !item.name.includes('pickaxe')
                    );
                    if (axe) await bot.equip(axe, 'hand');
                    await bot.dig(logBlock);
                    resolve(`Arbre cassé: ${logBlock.name}`);
                } catch (err) {
                    resolve(`Erreur: ${err instanceof Error ? err.message : String(err)}`);
                }
            };

            bot.once('goal_reached', listener);
        });
    },


    mineStone: async () => {
        const stoneBlock = bot.findBlock({
            matching: (block) => block.name === 'stone' || block.name === 'cobblestone',
            maxDistance: 32
        });

        if (!stoneBlock) return "Aucune pierre trouvée";

        if (!bot.canDigBlock(stoneBlock)) {
            return "Bot ne peut pas casser ce bloc (outil manquant?)";
        }

        // Access GoalBlock through bot.pathfinder
        const GoalBlock = (bot.pathfinder as any).GoalBlock;
        const goal = new GoalBlock(stoneBlock.position.x, stoneBlock.position.y, stoneBlock.position.z);
        bot.pathfinder.setGoal(goal);

        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                bot.removeListener('goal_reached', listener);
                resolve("Timeout - impossible d'atteindre la pierre");
            }, 10000);

            const listener = async () => {
                clearTimeout(timeout);
                bot.removeListener('goal_reached', listener);

                try {
                    const pickaxe = bot.inventory.items().find(item => item.name.includes('pickaxe'));
                    if (pickaxe) await bot.equip(pickaxe, 'hand');
                    await bot.dig(stoneBlock);
                    resolve(`Bot a cassé de la pierre (${stoneBlock.name})`);
                } catch (err) {
                    resolve(`Erreur lors du minage: ${err}`);
                }
            };

            bot.once('goal_reached', listener);
        });
    },

    craftPickaxe: async () => {
        try {
            const pickaxeItem = bot.registry.itemsByName.wooden_pickaxe;
            if (!pickaxeItem) return "Item pioche en bois non trouvé dans le registry";

            const recipe = bot.recipesFor(pickaxeItem.id, null, 1, null)[0];
            if (!recipe) return "Pas de recette trouvée pour la pioche";

            await bot.craft(recipe, 1);
            return "Bot a crafté une pioche en bois";
        } catch (error) {
            return `Erreur lors du craft de pioche: ${error instanceof Error ? error.message : String(error)}`;
        }
    },

    craftAxe: async () => {
        try {
            const axeItem = bot.registry.itemsByName.wooden_axe;
            if (!axeItem) return "Item hache en bois non trouvé dans le registry";

            const recipe = bot.recipesFor(axeItem.id, null, 1, null)[0];
            if (!recipe) return "Pas de recette trouvée pour la hache";

            await bot.craft(recipe, 1);
            return "Bot a crafté une hache en bois";
        } catch (error) {
            return `Erreur lors du craft de hache: ${error instanceof Error ? error.message : String(error)}`;
        }
    },

    // Based on the collectblock.js example
    collectNearbyItems: async () => {
        const itemEntity = bot.nearestEntity(entity => entity.name === 'item');
        if (!itemEntity) return "Aucun item trouvé à proximité";

        const GoalBlock = (bot.pathfinder as any).GoalBlock;
        const goal = new GoalBlock(itemEntity.position.x, itemEntity.position.y, itemEntity.position.z);
        bot.pathfinder.setGoal(goal);

        return new Promise((resolve) => {
            bot.once('goal_reached', async () => {
                resolve(`Bot se dirige vers l'item: ${itemEntity.displayName || 'item inconnu'}`);
                try {
                    await bot.activateEntity(itemEntity);
                    resolve(`Bot a collecté l'item: ${itemEntity.displayName || 'item inconnu'}`);
                } catch (err) {
                    resolve(`Erreur lors de la collecte de l'item: ${err}`);
                }
            });

            setTimeout(() => resolve("Timeout - impossible d'atteindre l'item"), 10000);
        });
    },

    // Based on the inventory.js example
    checkInventory: async () => {
        const items = bot.inventory.items();
        if (items.length === 0) return "Inventaire vide";

        const itemList = items.map(item => `${item.displayName || item.name} x${item.count}`).join(", ");
        return `Inventaire (${items.length} types d'items): ${itemList}`;
    },

    // Based on the digger.js example - dig blocks around the bot
    digAround: async () => {
        const blocksToDig = bot.findBlocks({
            matching: (block) => block.name === 'dirt' || block.name === 'grass_block',
            maxDistance: 2,
            count: 5
        });

        if (blocksToDig.length === 0) return "Aucun bloc à creuser trouvé";

        let dugCount = 0;

        for (const blockPos of blocksToDig) {
            const block = bot.blockAt(blockPos);
            if (!block || !bot.canDigBlock(block)) continue;

            try {
                await bot.dig(block);
                dugCount++;
            } catch (err) {
                console.log(`Erreur en creusant: ${err}`);
            }
        }

        return `Bot a creusé ${dugCount} blocs`;
    },

    // Follow the nearest player
    followPlayer: async () => {
        return new Promise<string>((resolve) => {
            const interval = setInterval(() => {
                const player = bot.nearestEntity(entity =>
                    entity.type === 'player' && entity !== bot.entity
                );

                if (player) {
                    // Access GoalFollow through bot.pathfinder
                    const GoalFollow = (bot.pathfinder as any).GoalFollow;
                    const goal = new GoalFollow(player, 2);
                    bot.pathfinder.setGoal(goal);
                    clearInterval(interval);
                    resolve("Bot suit le joueur");
                }
            }, 1000);

            setTimeout(() => {
                clearInterval(interval);
                resolve("Aucun joueur trouvé à suivre");
            }, 10000);
        });
    },
};