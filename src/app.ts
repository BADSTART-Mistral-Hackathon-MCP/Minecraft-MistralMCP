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
            bot.pathfinder.setGoal(new (require("mineflayer-pathfinder").GoalBlock)(x, y, z));
            bot.once("goal_reached", () => {
                resolve(`Bot reached coordinates (${x}, ${y}, ${z})`);
            });
            bot.once("path_update", (r: any) => {
                if (r.status === "noPath") reject("No path found");
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
        const questFunction = quests[quest];
        if (questFunction) {
            return await questFunction();
        } else {
            // Handle the case when the quest is not found
            return "Quest not found";
        }
    },
})



server.addTool({
    name: "coucou",
    description: "Bot dit 'coucou' et s'accroupit trois fois",
    parameters: z.object({}),
    execute: async () => {
        bot.chat("coucou");
        for (let i = 0; i < 3; i++) {
            bot.setControlState("sneak", true);
            await new Promise(resolve => setTimeout(resolve, 500));
            bot.setControlState("sneak", false);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
});

server.start();