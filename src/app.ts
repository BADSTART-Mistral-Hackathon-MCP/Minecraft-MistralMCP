import { FastMCP } from "fastmcp";
import { bot } from "./bot";
import { quests } from "./quest";
import { z } from "zod";

const server = new FastMCP({
    name: "Minecraft RPG Bot",
    version: "1.0.0",
});

server.addTool({
    name: "moveTo",
    description: "Move bot to coordinates",
    parameters: z.object({
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
        z: z.number().describe("Z coordinate"),
    }),
    execute: async ({ x, y, z }: { x: number; y: number; z: number }) => {
        return new Promise<string>((resolve, reject) => {
            // Check if bot is ready
            if (!bot.entity) {
                reject("Bot is not spawned yet");
                return;
            }

            const { GoalBlock } = require("mineflayer-pathfinder");
            bot.pathfinder.setGoal(new GoalBlock(x, y, z));

            const timeout = setTimeout(() => {
                reject("Timeout: Could not reach destination");
            }, 30000);

            bot.once("goal_reached", () => {
                clearTimeout(timeout);
                resolve(`Bot reached coordinates (${x}, ${y}, ${z})`);
            });

            bot.once("path_update", (r: any) => {
                if (r.status === "noPath") {
                    clearTimeout(timeout);
                    reject("No path found");
                }
            });
        });
    }
});

server.addTool({
    name: "say",
    description: "Make bot say something in chat",
    parameters: z.object({
        message: z.string().describe("Message to say in chat")
    }),
    execute: async ({ message }: { message: string }) => {
        if (!bot.entity) {
            throw new Error("Bot is not spawned yet");
        }
        bot.chat(message);
        return `Bot said: ${message}`;
    }
});

server.addTool({
    name: "quest",
    description: "Start a quest",
    parameters: z.object({
        quest: z.string().describe("Quest to start")
    }),
    execute: async ({ quest }: { quest: string }) => {
        if (!bot.entity) {
            throw new Error("Bot is not spawned yet");
        }

        const questFunction = quests[quest];
        if (questFunction) {
            return await questFunction();
        } else {
            return "Quest not found";
        }
    },
});

server.addTool({
    name: "coucou",
    description: "Bot dit 'coucou' et s'accroupit trois fois",
    parameters: z.object({}),
    execute: async () => {
        if (!bot.entity) {
            throw new Error("Bot is not spawned yet");
        }

        bot.chat("coucou");
        for (let i = 0; i < 3; i++) {
            bot.setControlState("sneak", true);
            await new Promise(resolve => setTimeout(resolve, 500));
            bot.setControlState("sneak", false);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        return "Bot said 'coucou' and crouched 3 times";
    }
});

// Wait for bot to spawn before starting MCP server
bot.once("spawn", () => {
    console.log("Bot spawned, starting MCP server...");

    // Start the MCP server after bot is ready
    server.start({
        transportType: "stdio",

    }).then(() => {
        console.log("MCP server started successfully");
    }).catch((error) => {
        console.error("Failed to start MCP server:", error);
    });
});

// Handle bot connection errors
bot.on('error', (err) => {
    console.error(`Bot error: ${err.message}`);
});

bot.on('end', (reason) => {
    console.log(`Bot disconnected: ${reason}`);
    process.exit(1);
});