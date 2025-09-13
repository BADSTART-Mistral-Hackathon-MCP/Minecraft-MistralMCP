import { bot } from "./bot";
import { goals } from "mineflayer-pathfinder";
import { Vec3 } from "vec3";

export type QuestFunction = () => Promise<string>;

export const quests: Record<string, QuestFunction> = {
    mineWood: async () => {
        const block = bot.findBlock({
            matching: (b) => b.name.includes("log"),
            maxDistance: 32
        });

        if (!block) return "Aucun arbre trouvé à proximité";

        // Move to the block first
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        bot.pathfinder.setGoal(goal);

        // Wait to get close to the block
        await new Promise<void>((resolve) => {
            const checkDistance = () => {
                const distance = bot.entity.position.distanceTo(block.position);
                if (distance <= 4) {
                    resolve();
                } else {
                    setTimeout(checkDistance, 100);
                }
            };
            checkDistance();
        });

        // Equip appropriate tool and dig
        await bot.tool.equipForBlock(block);
        await bot.dig(block);
        return `Bot a cassé du bois (${block.name})`;
    },

    mineStone: async () => {
        const block = bot.findBlock({
            matching: (b) => b.name.includes("stone"),
            maxDistance: 32
        });

        if (!block) return "Aucune pierre trouvée";

        // Move to the block first
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        bot.pathfinder.setGoal(goal);

        // Wait to get close to the block
        await new Promise<void>((resolve) => {
            const checkDistance = () => {
                const distance = bot.entity.position.distanceTo(block.position);
                if (distance <= 4) {
                    resolve();
                } else {
                    setTimeout(checkDistance, 100);
                }
            };
            checkDistance();
        });

        await bot.tool.equipForBlock(block);
        await bot.dig(block);
        return `Bot a cassé de la pierre (${block.name})`;
    },

    craftPickaxe: async () => {
        try {
            const pickaxeItem = bot.registry.itemsByName.wooden_pickaxe;
            if (!pickaxeItem) return "Item pioche en bois non trouvé";

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
            if (!axeItem) return "Item hache en bois non trouvé";

            const recipe = bot.recipesFor(axeItem.id, null, 1, null)[0];
            if (!recipe) return "Pas de recette trouvée pour la hache";

            await bot.craft(recipe, 1);
            return "Bot a crafté une hache en bois";
        } catch (error) {
            return `Erreur lors du craft de hache: ${error instanceof Error ? error.message : String(error)}`;
        }
    },

    // Additional useful quests
    collectItems: async () => {
        const items = bot.nearestEntity(entity => entity.name === 'item');
        if (!items) return "Aucun item trouvé à proximité";

        const goal = new goals.GoalBlock(items.position.x, items.position.y, items.position.z);
        bot.pathfinder.setGoal(goal);

        return "Bot se dirige vers l'item le plus proche";
    },

    checkInventory: async () => {
        const items = bot.inventory.items();
        if (items.length === 0) return "Inventaire vide";

        const itemList = items.map(item => `${item.name} x${item.count}`).join(", ");
        return `Inventaire: ${itemList}`;
    }
};