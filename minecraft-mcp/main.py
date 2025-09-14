# mcp-server/main.py - Enhanced with additional tools and actions
import asyncio
import aiohttp
import json
from typing import Dict, Any, Optional, List
from fastmcp import FastMCP
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import os

load_dotenv()

# Configuration
BOT_API_BASE = os.getenv("BOT_API_BASE", "http://localhost:3001")

# Initialize MCP server
mcp = FastMCP("Minecraft RPG Bot")

with open("mcp.json", "r", encoding="utf-8") as f:
    mcp_template = json.load(f)

@mcp.get("/capabilities")
async def get_capabilities():
    return JSONResponse(content=mcp_template)

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

# ============ CORE STATUS & HEALTH ============
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

# ============ MOVEMENT & NAVIGATION ============
@mcp.tool()
async def move_bot(x: float, y: float, z: float) -> str:
    """Move bot to specific coordinates using the correct endpoint"""
    result = await make_api_request("/movement/moveTo", "POST", {"x": x, "y": y, "z": z})
    
    if result.get("success"):
        return f"✅ {result.get('message', 'Movement completed')}"
    else:
        return f"❌ Movement failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def follow_player(player_name: str = "", distance: float = 3.0, continuous: bool = False) -> str:
    """Make bot follow a specific player. If no player_name provided, follows nearest player"""
    result = await make_api_request("/movement/follow", "POST", {
        "playerName": player_name,
        "distance": distance,
        "continuous": continuous
    })
    
    if result.get("success"):
        message = result.get('message', 'Following player')
        if not player_name.strip():
            return f"✅ {message} (auto-selected nearest player)"
        else:
            return f"✅ {message}"
    else:
        return f"❌ Follow failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def follow_nearest_player(distance: float = 3.0, continuous: bool = False) -> str:
    """Make bot follow the nearest available player automatically"""
    result = await make_api_request("/movement/follow", "POST", {
        "playerName": "",  # Empty string triggers nearest player selection
        "distance": distance,
        "continuous": continuous
    })
    
    if result.get("success"):
        return f"✅ {result.get('message', 'Following nearest player')}"
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
async def explore_area(radius: int = 20) -> str:
    """Make bot explore the surrounding area within given radius"""
    result = await make_api_request("/movement/explore", "POST", {"radius": radius})
    
    if result.get("success"):
        return f"🗺️ {result.get('message', 'Exploration started')}"
    else:
        return f"❌ Exploration failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def return_to_spawn() -> str:
    """Make bot return to spawn point"""
    result = await make_api_request("/movement/spawn", "POST")
    
    if result.get("success"):
        return f"🏠 {result.get('message', 'Returning to spawn')}"
    else:
        return f"❌ Return to spawn failed: {result.get('error', 'Unknown error')}"

# ============ COMMUNICATION ============
@mcp.tool()
async def bot_say(message: str) -> str:
    """Make the bot say something in chat"""
    result = await make_api_request("/chat/say", "POST", {"message": message})
    
    if result.get("success"):
        return f"💬 {result.get('message', 'Message sent')}"
    else:
        return f"❌ Chat failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def whisper_player(player_name: str, message: str) -> str:
    """Send a private message to a specific player"""
    result = await make_api_request("/chat/whisper", "POST", {
        "playerName": player_name,
        "message": message
    })
    
    if result.get("success"):
        return f"🤫 {result.get('message', 'Whisper sent')}"
    else:
        return f"❌ Whisper failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def get_nearby_players() -> str:
    """Get list of nearby players"""
    result = await make_api_request("/players/nearby")
    
    if not result.get("success"):
        return f"❌ Failed to get nearby players: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    players = data.get("players", [])
    
    if not players:
        return "👥 No players nearby"
    
    player_list = "\n".join([
        f"• {player.get('name', 'Unknown')} - Distance: {player.get('distance', 0):.1f} blocks"
        for player in players
    ])
    
    return f"👥 Nearby Players ({len(players)}):\n{player_list}"

# ============ ACTIONS & ANIMATIONS ============
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
async def bot_wave() -> str:
    """Make bot wave at nearby players"""
    result = await make_api_request("/bot/action/wave", "POST")
    
    if result.get("success"):
        return f"👋 {result.get('message', 'Bot waved')}"
    else:
        return f"❌ Wave action failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def bot_sit() -> str:
    """Make bot sit down (crouch and stay)"""
    result = await make_api_request("/bot/action/sit", "POST")
    
    if result.get("success"):
        return f"🪑 {result.get('message', 'Bot is sitting')}"
    else:
        return f"❌ Sit action failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def bot_stand() -> str:
    """Make bot stand up from sitting"""
    result = await make_api_request("/bot/action/stand", "POST")
    
    if result.get("success"):
        return f"🚶 {result.get('message', 'Bot stood up')}"
    else:
        return f"❌ Stand action failed: {result.get('error', 'Unknown error')}"

# ============ MINING & RESOURCES ============
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
async def mine_vein(block_type: str, max_blocks: int = 64) -> str:
    """Mine an entire vein of a specific block type (e.g., coal, iron)"""
    result = await make_api_request("/mining/vein", "POST", {
        "blockType": block_type,
        "maxBlocks": max_blocks
    })
    
    if result.get("success"):
        return f"⛏️ {result.get('message', 'Vein mining completed')}"
    else:
        return f"❌ Vein mining failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def collect_nearby_items(radius: int = 10) -> str:
    """Collect all dropped items within specified radius"""
    result = await make_api_request("/collection/items", "POST", {"radius": radius})
    
    if result.get("success"):
        return f"📦 {result.get('message', 'Items collected')}"
    else:
        return f"❌ Item collection failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def find_nearest_block(block_type: str, max_distance: int = 32) -> str:
    """Find the nearest block of specified type"""
    result = await make_api_request("/search/block", "POST", {
        "blockType": block_type,
        "maxDistance": max_distance
    })
    
    if not result.get("success"):
        return f"❌ Block search failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    if not data.get("found"):
        return f"🔍 No {block_type} found within {max_distance} blocks"
    
    pos = data.get("position", {})
    return f"""🎯 Found {block_type}:
• Position: ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)})
• Distance: {data.get('distance', 0):.1f} blocks"""

# ============ CRAFTING & TOOLS ============
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
async def craft_tools() -> str:
    """Automatically craft basic tools (pickaxe, axe, shovel) if materials available"""
    result = await make_api_request("/crafting/tools", "POST")
    
    if result.get("success"):
        return f"🔧 {result.get('message', 'Tools crafted')}"
    else:
        return f"❌ Tool crafting failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def smelt_items(item_type: str, count: int = 64) -> str:
    """Smelt items in a furnace (requires fuel)"""
    result = await make_api_request("/crafting/smelt", "POST", {
        "itemType": item_type,
        "count": count
    })
    
    if result.get("success"):
        return f"🔥 {result.get('message', 'Smelting completed')}"
    else:
        return f"❌ Smelting failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def get_crafting_recipes(item_name: str) -> str:
    """Get crafting recipes for a specific item"""
    result = await make_api_request(f"/crafting/recipe/{item_name}")
    
    if not result.get("success"):
        return f"❌ Recipe lookup failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    recipes = data.get("recipes", [])
    
    if not recipes:
        return f"📋 No recipes found for {item_name}"
    
    recipe_text = f"📋 Recipes for {item_name}:\n"
    for i, recipe in enumerate(recipes, 1):
        ingredients = recipe.get("ingredients", [])
        ingredient_list = ", ".join([f"{ing.get('count', 1)}x {ing.get('item', 'Unknown')}" for ing in ingredients])
        recipe_text += f"{i}. {ingredient_list}\n"
    
    return recipe_text.strip()

# ============ INVENTORY MANAGEMENT ============
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

@mcp.tool()
async def organize_inventory() -> str:
    """Organize and sort inventory items"""
    result = await make_api_request("/inventory/organize", "POST")
    
    if result.get("success"):
        return f"📋 {result.get('message', 'Inventory organized')}"
    else:
        return f"❌ Inventory organization failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def drop_item(item_name: str, count: int = 1) -> str:
    """Drop specific item from inventory"""
    result = await make_api_request("/inventory/drop", "POST", {
        "itemName": item_name,
        "count": count
    })
    
    if result.get("success"):
        return f"📤 {result.get('message', 'Item dropped')}"
    else:
        return f"❌ Drop failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def equip_item(item_name: str) -> str:
    """Equip an item from inventory"""
    result = await make_api_request("/inventory/equip", "POST", {"itemName": item_name})
    
    if result.get("success"):
        return f"⚔️ {result.get('message', 'Item equipped')}"
    else:
        return f"❌ Equip failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def check_storage(storage_type: str = "chest") -> str:
    """Check nearby storage containers (chest, barrel, etc.)"""
    result = await make_api_request("/storage/check", "POST", {"storageType": storage_type})
    
    if not result.get("success"):
        return f"❌ Storage check failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    containers = data.get("containers", [])
    
    if not containers:
        return f"📦 No {storage_type} containers found nearby"
    
    storage_text = f"📦 Found {len(containers)} {storage_type}(s):\n"
    for i, container in enumerate(containers, 1):
        pos = container.get("position", {})
        items = container.get("itemCount", 0)
        storage_text += f"{i}. Position: ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)}) - {items} items\n"
    
    return storage_text.strip()

# ============ BUILDING & CONSTRUCTION ============
@mcp.tool()
async def place_block(x: int, y: int, z: int, block_type: str) -> str:
    """Place a specific block at given coordinates"""
    result = await make_api_request("/building/place", "POST", {
        "x": x, "y": y, "z": z,
        "blockType": block_type
    })
    
    if result.get("success"):
        return f"🧱 {result.get('message', 'Block placed')}"
    else:
        return f"❌ Block placement failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def build_structure(structure_type: str, size: int = 5) -> str:
    """Build a predefined structure (house, tower, bridge, etc.)"""
    result = await make_api_request("/building/structure", "POST", {
        "structureType": structure_type,
        "size": size
    })
    
    if result.get("success"):
        return f"🏗️ {result.get('message', 'Structure built')}"
    else:
        return f"❌ Structure building failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def clear_area(radius: int = 5, depth: int = 3) -> str:
    """Clear an area around the bot by removing blocks"""
    result = await make_api_request("/building/clear", "POST", {
        "radius": radius,
        "depth": depth
    })
    
    if result.get("success"):
        return f"🧹 {result.get('message', 'Area cleared')}"
    else:
        return f"❌ Area clearing failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def fill_area(x1: int, y1: int, z1: int, x2: int, y2: int, z2: int, block_type: str) -> str:
    """Fill an area between two coordinates with specified block type"""
    result = await make_api_request("/building/fill", "POST", {
        "x1": x1, "y1": y1, "z1": z1,
        "x2": x2, "y2": y2, "z2": z2,
        "blockType": block_type
    })
    
    if result.get("success"):
        return f"🏗️ {result.get('message', 'Area filled')}"
    else:
        return f"❌ Area filling failed: {result.get('error', 'Unknown error')}"

# ============ FARMING ============
@mcp.tool()
async def plant_crops(crop_type: str, area_size: int = 5) -> str:
    """Plant crops in a specified area"""
    result = await make_api_request("/farming/plant", "POST", {
        "cropType": crop_type,
        "areaSize": area_size
    })
    
    if result.get("success"):
        return f"🌱 {result.get('message', 'Crops planted')}"
    else:
        return f"❌ Planting failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def harvest_crops(radius: int = 10) -> str:
    """Harvest mature crops in the area"""
    result = await make_api_request("/farming/harvest", "POST", {"radius": radius})
    
    if result.get("success"):
        return f"🌾 {result.get('message', 'Crops harvested')}"
    else:
        return f"❌ Harvesting failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def breed_animals(animal_type: str) -> str:
    """Breed nearby animals of the specified type"""
    result = await make_api_request("/farming/breed", "POST", {"animalType": animal_type})
    
    if result.get("success"):
        return f"🐄 {result.get('message', 'Animals bred')}"
    else:
        return f"❌ Breeding failed: {result.get('error', 'Unknown error')}"

# ============ QUEST SYSTEM ============
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

@mcp.tool()
async def create_custom_quest(quest_name: str, steps: List[str]) -> str:
    """Create a custom quest with specified steps"""
    result = await make_api_request("/quest/create", "POST", {
        "questName": quest_name,
        "steps": steps
    })
    
    if result.get("success"):
        return f"✨ {result.get('message', 'Custom quest created')}"
    else:
        return f"❌ Quest creation failed: {result.get('error', 'Unknown error')}"

# ============ COMBAT & SURVIVAL ============
@mcp.tool()
async def attack_nearest_hostile() -> str:
    """Attack the nearest hostile mob"""
    result = await make_api_request("/combat/attack", "POST")
    
    if result.get("success"):
        return f"⚔️ {result.get('message', 'Combat engaged')}"
    else:
        return f"❌ Attack failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def eat_food() -> str:
    """Eat food from inventory to restore hunger"""
    result = await make_api_request("/survival/eat", "POST")
    
    if result.get("success"):
        return f"🍖 {result.get('message', 'Food consumed')}"
    else:
        return f"❌ Eating failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def find_shelter() -> str:
    """Find or create shelter for nighttime/weather"""
    result = await make_api_request("/survival/shelter", "POST")
    
    if result.get("success"):
        return f"🏠 {result.get('message', 'Shelter found/created')}"
    else:
        return f"❌ Shelter search failed: {result.get('error', 'Unknown error')}"

# ============ ADVANCED FEATURES ============
@mcp.tool()
async def set_waypoint(name: str, x: float, y: float, z: float) -> str:
    """Set a named waypoint for future navigation"""
    result = await make_api_request("/navigation/waypoint", "POST", {
        "name": name,
        "x": x, "y": y, "z": z
    })
    
    if result.get("success"):
        return f"📍 {result.get('message', 'Waypoint set')}"
    else:
        return f"❌ Waypoint setting failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def goto_waypoint(name: str) -> str:
    """Navigate to a previously set waypoint"""
    result = await make_api_request("/navigation/goto", "POST", {"waypointName": name})
    
    if result.get("success"):
        return f"🧭 {result.get('message', 'Navigating to waypoint')}"
    else:
        return f"❌ Navigation failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def list_waypoints() -> str:
    """List all saved waypoints"""
    result = await make_api_request("/navigation/waypoints")
    
    if not result.get("success"):
        return f"❌ Failed to get waypoints: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    waypoints = data.get("waypoints", [])
    
    if not waypoints:
        return "📍 No waypoints saved"
    
    waypoint_text = "📍 Saved Waypoints:\n"
    for waypoint in waypoints:
        name = waypoint.get("name", "Unknown")
        pos = waypoint.get("position", {})
        waypoint_text += f"• {name}: ({pos.get('x', 0):.1f}, {pos.get('y', 0):.1f}, {pos.get('z', 0):.1f})\n"
    
    return waypoint_text.strip()

@mcp.tool()
async def patrol_area(waypoints: List[str], cycles: int = 1) -> str:
    """Patrol between multiple waypoints"""
    result = await make_api_request("/navigation/patrol", "POST", {
        "waypoints": waypoints,
        "cycles": cycles
    })
    
    if result.get("success"):
        return f"🚶 {result.get('message', 'Patrol started')}"
    else:
        return f"❌ Patrol failed: {result.get('error', 'Unknown error')}"

@mcp.tool()
async def scan_environment() -> str:
    """Scan the surrounding environment for resources, mobs, and structures"""
    result = await make_api_request("/scanner/environment", "POST")
    
    if not result.get("success"):
        return f"❌ Environment scan failed: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    
    scan_text = "🔍 Environment Scan Results:\n"
    
    # Resources
    resources = data.get("resources", [])
    if resources:
        scan_text += f"💎 Resources Found ({len(resources)}):\n"
        for resource in resources[:10]:  # Limit to 10 items
            pos = resource.get("position", {})
            scan_text += f"• {resource.get('type', 'Unknown')} at ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)})\n"
    
    # Mobs
    mobs = data.get("mobs", [])
    if mobs:
        scan_text += f"🐺 Mobs Found ({len(mobs)}):\n"
        for mob in mobs[:5]:  # Limit to 5 mobs
            pos = mob.get("position", {})
            scan_text += f"• {mob.get('type', 'Unknown')} at ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)}) - {mob.get('distance', 0):.1f}m\n"
    
    # Structures
    structures = data.get("structures", [])
    if structures:
        scan_text += f"🏠 Structures Found ({len(structures)}):\n"
        for structure in structures[:5]:  # Limit to 5 structures
            pos = structure.get("position", {})
            scan_text += f"• {structure.get('type', 'Unknown')} at ({pos.get('x', 0)}, {pos.get('y', 0)}, {pos.get('z', 0)})\n"
    
    if not resources and not mobs and not structures:
        scan_text += "• Nothing of interest found in the immediate area"
    
    return scan_text.strip()

@mcp.tool()
async def emergency_recall() -> str:
    """Emergency teleport to a safe location (spawn or set home)"""
    result = await make_api_request("/emergency/recall", "POST")
    
    if result.get("success"):
        return f"🚨 {result.get('message', 'Emergency recall completed')}"
    else:
        return f"❌ Emergency recall failed: {result.get('error', 'Unknown error')}"

# ============ RESOURCE SYSTEM ============
@mcp.resource(uri="minecraft://quests")
async def get_quest_info() -> str:
    """Get information about available quests"""
    return """🎯 Minecraft Bot Quest System

📋 Resource Gathering Quests:
• mineWood - Find and mine wood logs for basic materials
• mineStone - Find and mine stone/cobblestone (requires pickaxe)  
• mineOres - Search for and mine valuable ores (iron, coal, gold)
• collectNearbyItems - Collect dropped items in the area
• harvestCrops - Gather mature crops from farms

🔨 Crafting Quests:
• craftPickaxe - Craft a wooden pickaxe for mining
• craftAxe - Craft a wooden axe for chopping wood efficiently
• craftTools - Create full set of basic tools
• smeltOres - Process raw ores into ingots

🏗️ Building Quests:
• buildShelter - Create basic shelter for protection
• digAround - Clear area by digging dirt/grass blocks around bot
• buildFarm - Create automated crop farm
• constructBridge - Build bridges across water/gaps

🏃 Action Quests:
• followPlayer - Follow the nearest player automatically
• patrolArea - Guard and patrol a designated area  
• exploreRegion - Systematically explore surrounding terrain
• checkInventory - Display and organize current inventory

🤖 Autonomous Features:
• The bot can work independently when autonomous mode is enabled
• It will automatically choose appropriate quests based on current needs
• Safety checks ensure the bot maintains health and food levels
• The bot will craft tools when needed and gather resources efficiently
• Advanced pathfinding with obstacle avoidance
• Smart resource prioritization system

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
• bot_wave() - Wave at nearby players
• bot_sit() / bot_stand() - Sit down and stand up actions

⚙️ Advanced Features:
• Smart block detection (finds variations like oak_log, birch_log, etc.)
• Pathfinding with obstacle avoidance
• Automatic tool requirements checking
• Resource prioritization in autonomous mode
• Player interaction and following capabilities
• Waypoint navigation system
• Environmental scanning
• Combat and survival systems
• Farming automation
• Building and construction tools"""

@mcp.resource(uri="minecraft://commands")
async def get_command_info() -> str:
    """Get information about available bot commands"""
    return """🎮 Minecraft Bot Commands

📍 Movement & Navigation:
• move_bot(x, y, z) - Move to specific coordinates
• follow_player(name, distance) - Follow a player at set distance
• stop_movement() - Stop all movement
• get_position() - Get current position and orientation
• explore_area(radius) - Explore surrounding area
• return_to_spawn() - Return to spawn point
• set_waypoint(name, x, y, z) - Set named waypoint
• goto_waypoint(name) - Navigate to waypoint
• list_waypoints() - Show all saved waypoints
• patrol_area(waypoints, cycles) - Patrol between waypoints

💬 Communication:
• bot_say(message) - Send chat message
• whisper_player(player, message) - Private message
• get_nearby_players() - List nearby players

🎭 Actions & Animations:
• bot_coucou() - Friendly greeting action
• bot_dance() - Entertainment dance
• bot_jump() - Jump action
• bot_look_around() - Look in all directions
• bot_wave() - Wave at players
• bot_sit() / bot_stand() - Sit and stand actions

⛏️ Mining & Resources:
• mine_block(type, distance) - Mine specific block types
• mine_vein(type, max_blocks) - Mine entire ore veins
• collect_nearby_items(radius) - Gather dropped items
• find_nearest_block(type, distance) - Locate specific blocks

🔨 Crafting & Tools:
• craft_item(item, count) - Craft items from materials
• craft_tools() - Auto-craft basic tool set
• smelt_items(type, count) - Smelt ores in furnace
• get_crafting_recipes(item) - Show recipes

📦 Inventory Management:
• check_inventory() - View current items
• organize_inventory() - Sort and arrange items
• drop_item(item, count) - Drop specific items
• equip_item(item) - Equip tools/weapons
• check_storage(type) - View nearby containers

🏗️ Building & Construction:
• place_block(x, y, z, type) - Place blocks
• build_structure(type, size) - Build predefined structures
• clear_area(radius, depth) - Clear terrain
• fill_area(x1, y1, z1, x2, y2, z2, block) - Fill regions

🌾 Farming:
• plant_crops(type, size) - Plant crop fields
• harvest_crops(radius) - Harvest mature crops
• breed_animals(type) - Breed farm animals

⚔️ Combat & Survival:
• attack_nearest_hostile() - Fight hostile mobs
• eat_food() - Consume food for hunger
• find_shelter() - Create/find shelter

🎯 Quest System:
• start_quest(name) - Begin specific quest
• get_quest_progress() - Check active quest status
• stop_quest() - Cancel current quest
• get_available_quests() - List all available quests
• set_autonomous_mode(enabled) - Toggle independent behavior
• create_custom_quest(name, steps) - Create custom quests

🔍 Advanced Features:
• scan_environment() - Detailed area scan
• emergency_recall() - Emergency teleport to safety
• check_api_health() - Verify system status
• get_bot_status() - Complete bot information

🏥 System:
• get_bot_status() - Full bot status including health, position
• check_api_health() - Verify API connectivity

💡 Pro Tips:
• Use autonomous mode for hands-free gameplay
• Chain quests together for complex tasks
• Monitor health and food levels regularly
• Use follow_player for cooperative gameplay
• Set waypoints for efficient navigation
• Scan environment before starting major tasks
• Keep tools equipped for efficiency"""

@mcp.resource(uri="minecraft://blocks")
async def get_block_info() -> str:
    """Get information about common Minecraft blocks"""
    return """🧱 Minecraft Block Reference

🪵 Wood Types:
• oak_log, birch_log, spruce_log, jungle_log, acacia_log, dark_oak_log
• oak_planks, birch_planks, spruce_planks (and other wood variants)

🪨 Stone & Ores:
• stone, cobblestone, smooth_stone, stone_bricks
• coal_ore, iron_ore, gold_ore, diamond_ore, emerald_ore
• copper_ore, lapis_ore, redstone_ore

🌱 Natural Blocks:
• dirt, grass_block, sand, gravel, clay
• water, lava, obsidian, bedrock

🌾 Crops & Food:
• wheat, carrots, potatoes, beetroots
• pumpkin, melon, sugar_cane, cocoa_beans

🔨 Crafted Materials:
• iron_ingot, gold_ingot, diamond, emerald
• stick, coal, charcoal, redstone

💎 Tools & Equipment:
• wooden_pickaxe, stone_pickaxe, iron_pickaxe
• wooden_axe, stone_axe, iron_axe
• wooden_shovel, stone_shovel, iron_shovel
• wooden_sword, stone_sword, iron_sword

🏠 Building Materials:
• bricks, nether_bricks, end_stone_bricks
• glass, stained_glass, wool (various colors)
• concrete, terracotta, glazed_terracotta

💡 Usage Tips:
• Use specific block names for better success rates
• Bot can detect variations (e.g., "log" finds all log types)
• Some blocks require specific tools to mine efficiently
• Check tool durability before major mining operations"""

if __name__ == "__main__":
    # Run the MCP server
    mcp.run()