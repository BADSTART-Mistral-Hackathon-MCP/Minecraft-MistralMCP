# mcp-server/main.py - Updated to match your API endpoints
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
                    result = await response.json()
                    return result
            elif method == "POST":
                async with session.post(url, json=data) as response:
                    result = await response.json()
                    return result
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
    if not data:
        return "❌ No status data received"
        
    position = data.get('position', {})
    return f"""🤖 Bot Status:
• Connected: {'✅' if data.get('connected') else '❌'}
• Username: {data.get('username', 'N/A')}
• Health: {data.get('health', 'N/A')}/20 ❤️
• Food: {data.get('food', 'N/A')}/20 🍖
• Position: ({position.get('x', 0):.1f}, {position.get('y', 0):.1f}, {position.get('z', 0):.1f})
• Game Mode: {data.get('gameMode', 'N/A')}
• Players Online: {data.get('playersOnline', 0)}"""

@mcp.tool()
async def move_bot(x: float, y: float, z: float) -> str:
    """Move bot to specific coordinates using the correct endpoint"""
    result = await make_api_request("/movement/moveTo", "POST", {"x": x, "y": y, "z": z})
    
    if result.get("success"):
        return f"✅ {result.get('message', 'Movement completed')}"
    else:
        return f"❌ Movement failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def follow_player(player_name: str, distance: float = 3.0) -> str:
    """Make bot follow a specific player"""
    result = await make_api_request("/movement/follow", "POST", {
        "playerName": player_name, 
        "distance": distance
    })
    
    if result.get("success"):
        return f"✅ {result.get('message', 'Following player')}"
    else:
        return f"❌ Follow failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def stop_movement() -> str:
    """Stop all bot movement"""
    result = await make_api_request("/movement/stop", "POST")
    
    if result.get("success"):
        return f"✅ {result.get('message', 'Movement stopped')}"
    else:
        return f"❌ Stop failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def get_position() -> str:
    """Get bot's current position"""
    result = await make_api_request("/movement/position")
    
    if not result.get("success"):
        return f"❌ Position check failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    return f"""📍 Bot Position:
• X: {data.get('x', 0):.2f}
• Y: {data.get('y', 0):.2f}  
• Z: {data.get('z', 0):.2f}
• Yaw: {data.get('yaw', 0):.2f}°
• Pitch: {data.get('pitch', 0):.2f}°"""

@mcp.tool()
async def bot_say(message: str) -> str:
    """Make the bot say something in chat"""
    result = await make_api_request("/chat/say", "POST", {"message": message})
    
    if result.get("success"):
        return f"💬 {result.get('message', 'Message sent')}"
    else:
        return f"❌ Chat failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def mine_block(block_type: str, max_distance: int = 32) -> str:
    """Mine a specific type of block"""
    result = await make_api_request("/mining/block", "POST", {
        "blockType": block_type,
        "maxDistance": max_distance
    })
    
    if result.get("success"):
        return f"⛏️ {result.get('message', 'Mining completed')}"
    else:
        return f"❌ Mining failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def craft_item(item_name: str, count: int = 1) -> str:
    """Craft a specific item"""
    result = await make_api_request("/crafting/item", "POST", {
        "item": item_name,
        "count": count
    })
    
    if result.get("success"):
        return f"🔨 {result.get('message', 'Crafting completed')}"
    else:
        return f"❌ Crafting failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def check_inventory() -> str:
    """Check bot's current inventory"""
    result = await make_api_request("/inventory/")
    
    if not result.get("success"):
        return f"❌ Inventory check failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    items = data.get("items", [])
    total_items = data.get("totalItems", 0)
    
    if total_items == 0:
        return "📦 Inventory is empty"
    
    inventory_text = f"📦 Inventory ({total_items} items):\n"
    for item in items[:15]:  # Limit to first 15 items to avoid spam
        inventory_text += f"• {item.get('displayName', item.get('name', 'Unknown'))} x{item.get('count', 1)}\n"
    
    if len(items) > 15:
        inventory_text += f"... and {len(items) - 15} more items"
    
    return inventory_text.strip()

# QUEST SYSTEM TOOLS
@mcp.tool()
async def start_quest(quest_name: str) -> str:
    """Start a specific quest for autonomous bot behavior"""
    result = await make_api_request("/quest", "POST", {"questName": quest_name})
    
    if result.get("success"):
        return f"🎯 Quest '{quest_name}': {result.get('message', 'Quest started')}"
    else:
        error_msg = result.get('error', 'Unknown error')
        data = result.get('data', {})
        available_quests = data.get('availableQuests', [])
        if available_quests:
            return f"❌ Quest failed: {error_msg}\n📋 Available quests: {', '.join(available_quests)}"
        return f"❌ Quest failed: {error_msg}"

@mcp.tool()
async def get_quest_progress() -> str:
    """Get current quest progress"""
    result = await make_api_request("/quest/progress")
    
    if not result.get("success"):
        return f"❌ Failed to get quest progress: {result.get('error', 'Unknown error')}"
    
    data = result.get("data")
    if not data:
        return "📋 No active quest"
    
    progress_text = f"""🎯 Quest Progress:
• Quest: {data.get('questName', 'Unknown')}
• Current Step: {data.get('currentStep', 0) + 1}/{len(data.get('steps', []))}
• Completed: {'✅' if data.get('completed') else '🔄'}
• Started: {data.get('startTime', 'Unknown')}"""
    
    if data.get('steps'):
        current_step = data.get('currentStep', 0)
        if current_step < len(data['steps']):
            step = data['steps'][current_step]
            progress_text += f"\n• Current Step: {step.get('description', 'Unknown')}"
    
    return progress_text

@mcp.tool()
async def stop_quest() -> str:
    """Stop the current quest"""
    result = await make_api_request("/quest/stop", "POST")
    
    if result.get("success"):
        return f"🛑 {result.get('message', 'Quest stopped')}"
    else:
        return f"❌ Failed to stop quest: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def get_available_quests() -> str:
    """Get list of available quests"""
    result = await make_api_request("/quest/available")
    
    if not result.get("success"):
        return f"❌ Failed to get quests: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    quests = data.get("quests", [])
    
    if not quests:
        return "📋 No quests available"
    
    return f"📋 Available Quests:\n" + "\n".join([f"• {quest}" for quest in quests])

@mcp.tool()
async def set_autonomous_mode(enabled: bool) -> str:
    """Enable or disable autonomous mode"""
    result = await make_api_request("/quest/autonomous", "POST", {"enabled": enabled})
    
    if result.get("success"):
        return f"🤖 {result.get('message', 'Autonomous mode updated')}"
    else:
        return f"❌ Failed to set autonomous mode: {result.get('error', 'Unknown error')}"

# SPECIAL ACTIONS
@mcp.tool()
async def bot_coucou() -> str:
    """Make bot say 'coucou' and crouch 3 times"""
    result = await make_api_request("/bot/action/coucou", "POST")
    
    if result.get("success"):
        return f"😊 {result.get('message', 'Coucou action completed')}"
    else:
        return f"❌ Coucou action failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def bot_jump() -> str:
    """Make bot jump"""
    result = await make_api_request("/bot/action/jump", "POST")
    
    if result.get("success"):
        return f"🦘 {result.get('message', 'Bot jumped')}"
    else:
        return f"❌ Jump action failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def bot_dance() -> str:
    """Make bot perform a dance"""
    result = await make_api_request("/bot/action/dance", "POST")
    
    if result.get("success"):
        return f"💃 {result.get('message', 'Bot danced')}"
    else:
        return f"❌ Dance action failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def bot_look_around() -> str:
    """Make bot look around in all directions"""
    result = await make_api_request("/bot/action/lookAround", "POST")
    
    if result.get("success"):
        return f"👀 {result.get('message', 'Bot looked around')}"
    else:
        return f"❌ Look around failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def check_api_health() -> str:
    """Check if the bot API is running and accessible"""
    result = await make_api_request("/health")
    
    if result.get("success"):
        data = result.get("data", {})
        server_status = data.get("server", "unknown")
        bot_status = data.get("bot", "unknown")
        
        server_icon = "🟢" if server_status == "online" else "🔴"
        bot_icon = "🟢" if bot_status == "connected" else "🔴"
        
        return f"""🏥 API Health Check:
{server_icon} Server: {server_status}
{bot_icon} Bot: {bot_status}
📝 Message: {result.get('message', 'No message')}"""
    else:
        return f"❌ API Health Check Failed: {result.get('error', 'Cannot reach bot API')}"

# RESOURCE INFORMATION
@mcp.resource(uri="minecraft://quests")
async def get_quest_info() -> str:
    """Get information about available quests"""
    return """🎯 Minecraft Bot Quest System

📋 Resource Gathering Quests:
• mineWood - Find and mine wood logs for basic materials
• mineStone - Find and mine stone/cobblestone (requires pickaxe)  
• collectNearbyItems - Collect dropped items in the area

🔨 Crafting Quests:
• craftPickaxe - Craft a wooden pickaxe for mining
• craftAxe - Craft a wooden axe for chopping wood efficiently

🏃 Action Quests:
• digAround - Clear area by digging dirt/grass blocks around bot
• followPlayer - Follow the nearest player automatically
• checkInventory - Display and organize current inventory

🤖 Autonomous Features:
• The bot can work independently when autonomous mode is enabled
• It will automatically choose appropriate quests based on current needs
• Safety checks ensure the bot maintains health and food levels
• The bot will craft tools when needed and gather resources efficiently

💡 Usage Examples:
• start_quest("mineWood") - Begin wood gathering
• set_autonomous_mode(true) - Enable independent behavior  
• get_quest_progress() - Check current quest status
• stop_quest() - Stop current quest if needed

🎮 Special Actions:
• bot_coucou() - Friendly greeting with crouching animation
• bot_dance() - Entertainment dance routine
• bot_jump() - Simple jump action
• bot_look_around() - Scan surroundings by looking in all directions

⚙️ Advanced Features:
• Smart block detection (finds variations like oak_log, birch_log, etc.)
• Pathfinding with obstacle avoidance
• Automatic tool requirements checking
• Resource prioritization in autonomous mode
• Player interaction and following capabilities"""

@mcp.resource(uri="minecraft://commands")
async def get_command_info() -> str:
    """Get information about available bot commands"""
    return """🎮 Minecraft Bot Commands

📍 Movement Commands:
• move_bot(x, y, z) - Move to specific coordinates
• follow_player(name, distance) - Follow a player at set distance
• stop_movement() - Stop all movement
• get_position() - Get current position and orientation

💬 Communication:
• bot_say(message) - Send chat message
• bot_coucou() - Friendly greeting action
• bot_dance() - Entertainment dance
• bot_jump() - Jump action
• bot_look_around() - Look in all directions

⛏️ Mining & Crafting:
• mine_block(type, distance) - Mine specific block types
• craft_item(item, count) - Craft items from materials
• check_inventory() - View current items

🎯 Quest System:
• start_quest(name) - Begin specific quest
• get_quest_progress() - Check active quest status
• stop_quest() - Cancel current quest
• get_available_quests() - List all available quests
• set_autonomous_mode(enabled) - Toggle independent behavior

🏥 System:
• get_bot_status() - Full bot status including health, position
• check_api_health() - Verify API connectivity

💡 Pro Tips:
• Use autonomous mode for hands-free gameplay
• Chain quests together for complex tasks
• Monitor health and food levels regularly
• Use follow_player for cooperative gameplay"""

if __name__ == "__main__":
    # Run the MCP server
    mcp.run()