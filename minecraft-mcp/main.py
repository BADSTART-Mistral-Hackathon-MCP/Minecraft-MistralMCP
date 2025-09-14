# mcp-server/main.py - Fixed version for FastMCP
import asyncio
import aiohttp
import json
from typing import Dict, Any, Optional, List
from fastmcp import FastMCP
from dotenv import load_dotenv
import os

load_dotenv()

# Configuration
BOT_API_BASE = os.getenv("BOT_API_BASE", "http://localhost:3001")

# Initialize MCP server
mcp = FastMCP("Minecraft RPG Bot")

async def make_api_request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make HTTP request to bot API with comprehensive error handling"""
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

# ============ HEALTH & STATUS ============
@mcp.tool()
async def check_api_health() -> str:
    """
    Verify the bridge server API connectivity and operational status.
    
    Performs a health check on the bridge server to ensure:
    - The HTTP API is responding to requests
    - The bot connection to Minecraft server is active
    - All systems are operational and ready to receive commands
    
    Use this before starting any bot operations to ensure system readiness.
    Returns server status, bot connection state, and any system messages.
    """
    result = await make_api_request("/health")
    
    if result.get("success"):
        data = result.get("data", {})
        server_status = data.get("server", "unknown")
        bot_status = data.get("bot", "unknown")
        
        server_icon = "🟢" if server_status == "online" else "🔴"
        bot_icon = "🟢" if bot_status == "connected" else "🔴"
        
        return f"""🏥 System Health Report:
{server_icon} Bridge Server: {server_status}
{bot_icon} Minecraft Bot: {bot_status}
📝 Status: {result.get('message', 'No additional information')}
🔗 API Endpoint: {BOT_API_BASE}"""
    else:
        return f"❌ Health Check Failed: {result.get('error', 'Cannot reach bot API')}"

@mcp.tool()
async def get_bot_status() -> str:
    """
    Retrieve comprehensive bot status information including connection state, health metrics, and world position.
    
    Returns detailed information about:
    - Bot connection status (connected/disconnected)
    - Current username and authentication state
    - Health points (0-20 scale) and food level (0-20 scale)
    - Precise world coordinates (X, Y, Z) with decimal precision
    - Current game mode (survival, creative, adventure, spectator)
    - Number of players currently online in the server
    
    This is essential for monitoring bot wellbeing and ensuring it's operational before issuing commands.
    """
    result = await make_api_request("/bot/status")
    
    if not result.get("success"):
        return f"❌ Error: {result.get('error', 'Unknown error')}"
    
    data = result.get("data", {})
    if not data:
        return "❌ No status data received"
        
    position = data.get('position', {})
    return f"""🤖 Bot Status Report:
• Connection: {'✅ Online' if data.get('connected') else '❌ Offline'}
• Username: {data.get('username', 'N/A')}
• Health: {data.get('health', 'N/A')}/20 ❤️ ({(data.get('health', 0) / 20 * 100):.0f}%)
• Hunger: {data.get('food', 'N/A')}/20 🍖 ({(data.get('food', 0) / 20 * 100):.0f}%)
• Position: ({position.get('x', 0):.1f}, {position.get('y', 0):.1f}, {position.get('z', 0):.1f})
• Game Mode: {data.get('gameMode', 'N/A')}
• Players Online: {data.get('playersOnline', 0)}"""

# ============ MOVEMENT & NAVIGATION ============
@mcp.tool()
async def move_bot_to_coordinates(x: float, y: float, z: float) -> str:
    """
    Move the bot to specific world coordinates using advanced pathfinding.
    
    Parameters:
    - x (float): Target X coordinate in the world
    - y (float): Target Y coordinate (height/elevation)
    - z (float): Target Z coordinate in the world
    
    The bot uses mineflayer-pathfinder for intelligent navigation that:
    - Calculates optimal paths avoiding obstacles
    - Handles terrain elevation changes automatically
    - Navigates around water, lava, and other hazards
    - Breaks blocks if necessary to reach the destination
    - Times out after 30 seconds if unreachable
    
    Returns success confirmation with reached coordinates or error details if movement fails.
    """
    result = await make_api_request("/movement/moveTo", "POST", {"x": x, "y": y, "z": z})
    
    if result.get("success"):
        return f"✅ Navigation Complete: {result.get('message', 'Bot reached destination')}"
    else:
        return f"❌ Movement Failed: {result.get('error', 'Pathfinding error or unreachable destination')}"

@mcp.tool()
async def follow_player(player_name: str = "", distance: float = 3.0, continuous: bool = False) -> str:
    """
    Make the bot follow a specific player by name, or automatically find the nearest player if no name provided.
    
    Parameters:
    - player_name (str, optional): Exact username of the player to follow. Leave empty to auto-select nearest player.
    - distance (float, optional): Maintain this distance in blocks from the target player (default: 3.0)
    - continuous (bool, optional): If True, bot keeps following even when player moves (default: False)
    
    Advanced following behavior:
    - If player_name is empty, automatically finds and follows the nearest player
    - Uses pathfinder's GoalFollow for smooth, intelligent tracking
    - Maintains specified distance while avoiding getting too close
    - Continuous mode enables persistent following of moving targets
    - Automatically handles terrain obstacles and elevation changes
    - Stops following if target player disconnects or moves out of render distance
    
    Distance recommendations: 2-3 blocks for close following, 5-8 blocks for escort missions.
    """
    result = await make_api_request("/movement/follow", "POST", {
        "playerName": player_name,
        "distance": distance,
        "continuous": continuous
    })
    
    if result.get("success"):
        if not player_name.strip():
            return f"✅ Auto-Following: Nearest player at {distance} blocks distance"
        else:
            follow_mode = "continuously" if continuous else "until reached"
            return f"✅ Following Player: {player_name} at {distance} blocks distance ({follow_mode})"
    else:
        return f"❌ Follow Failed: {result.get('error', 'Player not found or unreachable')}"

@mcp.tool()
async def stop_all_movement() -> str:
    """
    Immediately halt all bot movement and clear all active control states.
    
    This emergency stop function:
    - Cancels any active pathfinding goals
    - Stops all movement controls (forward, backward, left, right)
    - Disables jumping, sprinting, and sneaking states
    - Clears following targets and waypoint navigation
    - Provides immediate response for safety situations
    
    Use when bot needs to stop urgently or before issuing conflicting movement commands.
    """
    result = await make_api_request("/movement/stop", "POST")
    
    if result.get("success"):
        return f"🛑 Movement Stopped: {result.get('message', 'All motion and controls disabled')}"
    else:
        return f"❌ Stop Command Failed: {result.get('error', 'Unable to halt movement')}"

@mcp.tool()
async def get_bot_position_detailed() -> str:
    """
    Retrieve precise bot location and orientation data.
    
    Returns comprehensive positional information:
    - World coordinates (X, Y, Z) with decimal precision
    - Yaw rotation (horizontal facing direction, 0-360 degrees)
    - Pitch rotation (vertical looking angle, -90 to +90 degrees)
    - Coordinate interpretation for navigation planning
    
    Coordinate system reference:
    - X: East (+) / West (-) axis
    - Y: Up (+) / Down (-) elevation, sea level ≈ 63
    - Z: South (+) / North (-) axis
    - Yaw: 0°=South, 90°=West, 180°=North, 270°=East
    """
    result = await make_api_request("/movement/position")
    
    if not result.get("success"):
        return f"❌ Position Check Failed: {result.get('error', 'Unable to determine location')}"
    
    data = result.get("data", {})
    
    # Calculate cardinal direction from yaw
    yaw = data.get('yaw', 0)
    directions = ['South', 'Southwest', 'West', 'Northwest', 'North', 'Northeast', 'East', 'Southeast']
    direction_index = int((yaw + 22.5) % 360 // 45)
    facing = directions[direction_index]
    
    return f"""📍 Bot Position Details:
• Coordinates: ({data.get('x', 0):.2f}, {data.get('y', 0):.2f}, {data.get('z', 0):.2f})
• Elevation: {data.get('y', 0):.1f} blocks (sea level ≈ 63)
• Facing Direction: {facing} ({data.get('yaw', 0):.1f}° yaw)
• Look Angle: {data.get('pitch', 0):.1f}° pitch
• Grid Reference: X{data.get('x', 0):+.0f} Z{data.get('z', 0):+.0f}"""

# ============ COMMUNICATION ============
@mcp.tool()
async def send_chat_message(message: str) -> str:
    """
    Send a message to the server chat visible to all players.
    
    Parameters:
    - message (str): Text content to broadcast (max 256 characters)
    
    Message handling features:
    - Automatically truncates messages over 256 characters to prevent kicks
    - Supports Unicode characters and basic formatting
    - Visible to all players in the server
    - Logged in server chat history
    - Can include coordinates, item names, or player references
    
    Note: Very long messages are automatically split to avoid protocol violations.
    Use for announcements, status updates, or communication with players.
    """
    # Ensure message length is within Minecraft limits
    if len(message) > 256:
        message = message[:253] + "..."
        
    result = await make_api_request("/chat/say", "POST", {"message": message})
    
    if result.get("success"):
        return f"💬 Message Sent: '{message}'"
    else:
        return f"❌ Chat Failed: {result.get('error', 'Message could not be delivered')}"

# ============ MINING & RESOURCE GATHERING ============
@mcp.tool()
async def mine_specific_block(block_type: str, max_search_distance: int = 32) -> str:
    """
    Locate, approach, and mine a specific type of block using intelligent pathfinding.
    
    Parameters:
    - block_type (str): Target block name (e.g., "stone", "iron_ore", "coal_ore", "oak_log")
    - max_search_distance (int, optional): Maximum blocks to search from current position (default: 32)
    
    Advanced mining capabilities:
    - Scans area for nearest matching block within search radius
    - Supports partial name matching (e.g., "log" finds any wood type)
    - Automatically navigates to block location using pathfinding
    - Verifies block is mineable and bot has appropriate tools
    - Handles elevation changes and obstacle avoidance
    - Automatically equips best available tool for the job
    - Returns precise location coordinates of mined block
    
    Block type examples: stone, cobblestone, iron_ore, coal_ore, diamond_ore, oak_log, dirt, sand, gravel.
    Search distance affects performance: larger values take more time but find distant resources.
    """
    result = await make_api_request("/mining/block", "POST", {
        "blockType": block_type,
        "maxDistance": max_search_distance
    })
    
    if result.get("success"):
        return f"⛏️ Mining Complete: {result.get('message', f'Successfully mined {block_type}')}"
    else:
        return f"❌ Mining Failed: {result.get('error', f'Cannot find or mine {block_type}')}"

# ============ CRAFTING & PRODUCTION ============
@mcp.tool()
async def craft_item_with_count(item_name: str, count: int = 1) -> str:
    """
    Craft specific items using bot's inventory materials and available recipes.
    
    Parameters:
    - item_name (str): Exact item name to craft (e.g., "wooden_pickaxe", "stick", "torch")
    - count (int, optional): Number of items to craft (default: 1, limited by materials)
    
    Advanced crafting system:
    - Automatically searches bot's recipe knowledge for the item
    - Verifies required materials are available in inventory
    - Handles both 2x2 inventory crafting and 3x3 crafting table recipes
    - Supports crafting of tools, blocks, food, and complex items
    - Returns detailed success/failure information with material requirements
    
    Common craftable items: sticks, torches, tools (wooden/stone/iron), blocks, food items.
    The bot must have learned the recipe previously or have a crafting table nearby for complex items.
    """
    result = await make_api_request("/crafting/item", "POST", {
        "item": item_name,
        "count": count
    })
    
    if result.get("success"):
        return f"🔨 Crafting Success: {result.get('message', f'Created {count}x {item_name}')}"
    else:
        error_msg = result.get('error', 'Crafting failed')
        return f"❌ Crafting Failed: {error_msg}"

# ============ INVENTORY MANAGEMENT ============
@mcp.tool()
async def check_inventory_contents() -> str:
    """
    Examine the bot's complete inventory with detailed item information.
    
    Provides comprehensive inventory analysis:
    - Complete list of all carried items with quantities
    - Item display names and internal identifiers
    - Slot positions for each item (0-35 for player inventory)
    - Total unique item types and overall item count
    - Inventory space utilization and available slots
    - Organization status and item distribution
    
    Essential for:
    - Planning crafting operations (checking material availability)
    - Managing inventory space before major gathering operations
    - Identifying tools, weapons, and consumables
    - Monitoring resource accumulation over time
    
    Returns organized, readable format limited to prevent spam while showing all critical information.
    """
    result = await make_api_request("/inventory")
    
    if not result.get("success"):
        return f"❌ Inventory Check Failed: {result.get('error', 'Cannot access inventory data')}"
    
    data = result.get("data", {})
    items = data.get("items", [])
    total_items = data.get("totalItems", 0)
    
    if total_items == 0:
        return "📦 Inventory Status: Empty (0/36 slots used)"
    
    # Group similar items and calculate totals
    item_summary = {}
    for item in items:
        display_name = item.get('displayName', item.get('name', 'Unknown'))
        count = item.get('count', 1)
        if display_name in item_summary:
            item_summary[display_name] += count
        else:
            item_summary[display_name] = count
    
    inventory_text = f"📦 Inventory Summary ({len(item_summary)} types, {total_items} total items):\n"
    
    # Show top 15 items to prevent excessive output
    for i, (name, count) in enumerate(sorted(item_summary.items(), key=lambda x: x[1], reverse=True)[:15]):
        inventory_text += f"• {name}: {count}x\n"
    
    if len(item_summary) > 15:
        remaining = len(item_summary) - 15
        inventory_text += f"... and {remaining} more item types"
    
    # Calculate approximate fullness
    fullness = min(100, (total_items / 36) * 100)
    inventory_text += f"\n📊 Inventory Fullness: {fullness:.0f}% ({total_items}/36 max stacks)"
    
    return inventory_text.strip()


if __name__ == "__main__":
    # Run the MCP server
    mcp.run(port=8080)