import mineflayer from "mineflayer";
import { pathfinder, Movements } from "mineflayer-pathfinder";

export const bot = mineflayer.createBot({
    host: process.env.HOST || "RayaneBiBI.aternos.me",
    username: process.env.USERNAME || "Mistral BOT",
    auth: "microsoft",
    port: parseInt(process.env.PORT || "32995"),
    password: process.env.PASSWORD || "Maurice1003",
    version: "1.21.1"
});

// Load pathfinder plugin
bot.loadPlugin(pathfinder);

bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    bot.chat(message);
});

bot.once("spawn", () => {
    console.log("Bot has spawned in the world!");
    console.log(`Health: ${bot.health}, Food: ${bot.food}`);
    console.log(`Game mode: ${bot.game.gameMode}`);

    // Initialize pathfinder movements after spawn
    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
});

// Equipment events (correct event from API)
bot.on("entityEquip", (entity: any) => {
    if (entity === bot.entity) {
        console.log(`Bot equipped: ${entity.equipment ? entity.equipment.values : 'nothing'}`);
    }
});

// Monitor the heldItem property changes
bot.on("heldItemChanged", (heldItem) => {
    console.log(`Bot switched held item to: ${heldItem ? heldItem.name : 'nothing'}`);
});



bot.on("diggingCompleted", (block) => {
    console.log(`Bot finished digging: ${block.name} at ${block.position}`);
});

bot.on("diggingAborted", (block) => {
    console.log(`Bot stopped digging: ${block.name} at ${block.position}`);
});

// Pathfinder events
bot.on("goal_reached", (goal) => {
    console.log("Bot reached its goal!");
});

bot.on("path_update", (r: { status: "timeout" | "partial" | "partialPath" | "success" | "noPath" }) => {
    if (r.status === "noPath") {
        console.log("Bot could not find a path to the goal");
    } else if (r.status === "success") {
        console.log("Bot found a path to the goal");
    } else if (r.status === "partialPath") {
        console.log("Bot found a partial path to the goal");
    }
});

// Health and experience events (properties from API)
bot.on("health", () => {
    console.log(`Bot health: ${bot.health}, food: ${bot.food}, saturation: ${bot.foodSaturation}`);

    // Auto-eat if food is low (based on auto-eat example)
    if (bot.food < 16) {
        const food = bot.inventory.items().find(item =>
            item.name.includes('bread') ||
            item.name.includes('apple') ||
            item.name.includes('carrot') ||
            item.name.includes('potato')
        );

        if (food) {
            bot.equip(food, 'hand').then(() => {
                bot.consume().catch(console.error);
            }).catch(console.error);
        }
    }
});

bot.on("experience", () => {
    console.log(`Bot experience: level ${bot.experience.level} (${bot.experience.points}/${bot.experience.progress})`);
});

// Inventory events
bot.on("windowOpen", (window) => {
    console.log(`Bot opened window: ${window.title || 'unknown'}`);
});

bot.on("windowClose", (window) => {
    console.log(`Bot closed window: ${window.title || 'unknown'}`);
});

// Chat events for better interaction
bot.on("whisper", (username, message, translate, jsonMsg, matches) => {
    console.log(`${username} whispered: ${message}`);
});

// Connection events
bot.on('kicked', (reason, loggedIn) => {
    console.log(`Bot was kicked: ${reason}`);
});

bot.on('error', (err) => {
    console.error(`Bot error: ${err.message}`);
});

bot.on('end', (reason) => {
    console.log(`Bot disconnected: ${reason}`);
});

// Weather events
bot.on('rain', () => {
    if (bot.isRaining) {
        console.log('It started raining');
    } else {
        console.log('It stopped raining');
    }
});

bot.on('time', () => {
    // Log time changes occasionally
    if (bot.time.timeOfDay % 6000 === 0) { // Every 5 minutes in game time
        console.log(`Game time: ${bot.time.timeOfDay} (${bot.time.isDay ? 'day' : 'night'})`);
    }
});

// Player join/leave events
bot.on('playerJoined', (player) => {
    console.log(`Player joined: ${player.username}`);
});

bot.on('playerLeft', (player) => {
    console.log(`Player left: ${player.username}`);
});

// Entity events for awareness
bot.on('entitySpawn', (entity) => {
    if (entity.type === 'player') {
        console.log(`Player spawned: ${entity.username}`);
    } else if (entity.type === 'mob') {
        console.log(`Mob spawned: ${entity.mobType || entity.name}`);
    }
});

bot.on('entityDead', (entity) => {
    if (entity.type === 'player') {
        console.log(`Player died: ${entity.username}`);
    }
});

// Death event
bot.on('death', () => {
    console.log('Bot died! Respawning...');
    bot.respawn();
});