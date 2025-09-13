import mineflayer from "mineflayer";
import { pathfinder, Movements } from "mineflayer-pathfinder";

export const bot = mineflayer.createBot({
    host: process.env.HOST || "localhost",
    username: process.env.USERNAME || "bot",
    auth: "microsoft",
    port: parseInt(process.env.PORT || "25565"),
    password: process.env.PASSWORD || "",
});

bot.loadPlugin(pathfinder);

bot.on("chat", (username, message) => {
    if (username === bot.username) return;
    bot.chat(message);
});

bot.on("spawn", () => {
    console.log("Bot has spawned in the world!");

    const defaultMove = new Movements(bot);
    bot.pathfinder.setMovements(defaultMove);
});

bot.on("tool", (tool) => {
    console.log(`Equipped tool: ${tool.name}`);
})

bot.on('kicked', console.log);
bot.on('error', console.log);
bot.on('end', console.log);