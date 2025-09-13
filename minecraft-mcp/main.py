# mcp-server/main.py
import asyncio
import aiohttp
import json
from typing import Dict, Any, Optional
from fastmcp import FastMCP
from dotenv import load_dotenv
import os

load_dotenv()

# Configuration
BOT_API_BASE = os.getenv("BOT_API_BASE", "http://localhost:3001")

# Initialize MCP server
mcp = FastMCP("Minecraft RPG Bot")

async def make_api_request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make HTTP request to bot API"""
    url = f"{BOT_API_BASE}{endpoint}"
    
    try:
        async with aiohttp.ClientSession() as session:
            if method == "GET":
                async with session.get(url) as response:
                    return await response.json()
            elif method == "POST":
                async with session.post(url, json=data) as response:
                    return await response.json()
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
    except aiohttp.ClientError as e:
        return {
            "success": False,
            "error": f"Connection error: {str(e)}"
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Request failed: {str(e)}"
        }

@mcp.tool()
async def get_bot_status() -> str:
    """Get current bot status, health, position and connection info"""
    result = await make_api_request("/bot/status")
    
    if not result.get("success"):
        return f"❌ Error: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    return f"""🤖 Bot Status:
• Username: {data.get('username', 'N/A')}
• Health: {data.get('health', 'N/A')}/20 ❤️
• Food: {data.get('food', 'N/A')}/20 🍖
• Position: ({data.get('position', {}).get('x', 0):.1f}, {data.get('position', {}).get('y', 0):.1f}, {data.get('position', {}).get('z', 0):.1f})
• Game Mode: {data.get('gameMode', 'N/A')}
• Players Online: {data.get('playersOnline', 0)}
• Inventory Items: {data.get('inventory', 0)}"""

@mcp.tool()
async def move_bot(x: float, y: float, z: float) -> str:
    """Move bot to specific coordinates"""
    result = await make_api_request("/bot/move", "POST", {"x": x, "y": y, "z": z})
    
    if result.get("success"):
        return f"✅ {result.get('message', 'Movement completed')}"
    else:
        return f"❌ Movement failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def bot_say(message: str) -> str:
    """Make the bot say something in chat"""
    result = await make_api_request("/bot/say", "POST", {"message": message})
    
    if result.get("success"):
        return f"💬 {result.get('message', 'Message sent')}"
    else:
        return f"❌ Chat failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def start_quest(quest_name: str) -> str:
    """Start a specific quest. Available quests: mineWood, mineStone, craftPickaxe, craftAxe, collectNearbyItems, checkInventory, digAround, followPlayer"""
    result = await make_api_request("/quest", "POST", {"questName": quest_name})


    
    if result.get("success"):
        return f"🎯 Quest '{quest_name}': {result.get('message', 'Quest completed')}"
    else:
        error_msg = result.get('error', 'Unknown error')
        available_quests = result.get('availableQuests', [])
        if available_quests:
            return f"❌ Quest failed: {error_msg}\n📋 Available quests: {', '.join(available_quests)}"
        return f"❌ Quest failed: {error_msg}"

@mcp.tool()
async def bot_coucou() -> str:
    """Make bot say 'coucou' and crouch 3 times"""
    result = await make_api_request("/bot/action/coucou", "POST")
    
    if result.get("success"):
        return f"😊 {result.get('message', 'Coucou action completed')}"
    else:
        return f"❌ Coucou action failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def check_inventory() -> str:
    """Check bot's current inventory"""
    result = await make_api_request("/bot/inventory")
    
    if not result.get("success"):
        return f"❌ Inventory check failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    inventory = data.get("inventory", [])
    total_items = data.get("totalItems", 0)
    
    if total_items == 0:
        return "📦 Inventory is empty"
    
    inventory_text = "📦 Inventory:\n"
    for item in inventory:
        inventory_text += f"• {item.get('displayName', item.get('name', 'Unknown'))} x{item.get('count', 1)}\n"
    
    return inventory_text.strip()

@mcp.tool()
async def check_api_health() -> str:
    """Check if the bot API is running and accessible"""
    result = await make_api_request("/health")
    
    if result.get("success"):
        bot_connected = result.get("botConnected", False)
        status = "🟢 Connected" if bot_connected else "🔴 Disconnected"
        return f"🏥 API Status: {result.get('status', 'Unknown')}\n🤖 Bot: {status}"
    else:
        return f"❌ API Health Check Failed: {result.get('error', 'Cannot reach bot API')}"

# Resource for quest information
@mcp.resource(uri="minecraft://quests")
async def get_quest_info() -> str:
    """Get information about available quests"""
    return """🎯 Available Minecraft Bot Quests:

📋 Resource Gathering:
• mineWood - Find and mine wood logs
• mineStone - Find and mine stone/cobblestone  
• collectNearbyItems - Collect dropped items nearby

🔨 Crafting:
• craftPickaxe - Craft a wooden pickaxe
• craftAxe - Craft a wooden axe

🏃 Actions:
• digAround - Dig dirt/grass blocks around the bot
• followPlayer - Follow the nearest player
• checkInventory - Display current inventory contents

💡 Usage: Use the start_quest tool with the quest name, e.g., start_quest("mineWood")"""

if __name__ == "__main__":
    # Run the MCP server
    mcp.run()