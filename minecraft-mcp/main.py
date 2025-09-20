# mcp/src/main.py
import asyncio
import json
import os
import logging
from typing import Any, Dict, List, Optional
import httpx
import socketio
from dotenv import load_dotenv
from pydantic import BaseModel
from fastmcp import FastMCP
from mistralai import Mistral
import threading

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment variables
BOT_API_URL = os.getenv('BOT_API_URL', 'http://localhost:3001')
MISTRAL_API_KEY = os.getenv('MISTRAL_API_KEY')
BOT_NAME = os.getenv('BOT_NAME', 'AIBot')

if not MISTRAL_API_KEY:
    raise ValueError("MISTRAL_API_KEY environment variable is required")

# Initialize clients
mistral_client = Mistral(api_key=MISTRAL_API_KEY)
sio = socketio.AsyncClient()


class BotContext:
    """Maintains current bot state and context"""
    def __init__(self):
        self.state: Dict[str, Any] = {}
        self.recent_messages: List[Dict[str, Any]] = []
        self.active_tasks: List[str] = []

    def update_state(self, new_state: Dict[str, Any]):
        self.state.update(new_state)

    def add_message(self, username: str, message: str):
        self.recent_messages.append({
            'username': username,
            'message': message,
            'timestamp': asyncio.get_event_loop().time()
        })
        if len(self.recent_messages) > 20:
            self.recent_messages = self.recent_messages[-20:]


bot_context = BotContext()


# Request/Response models
class Position(BaseModel):
    x: float
    y: float
    z: float


class BotResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    
    @property
    def message_or_error(self) -> str:
        """Get message for success or error for failures"""
        return self.message or self.error or "Unknown response"


class MCPBotServer:
    def __init__(self):
        self.mcp = FastMCP("minecraft-bot")
        self.http_client = httpx.AsyncClient()
        self.setup_tools()

    async def bot_api_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[str, Any]:
        """Make HTTP request to bot API"""
        try:
            url = f"{BOT_API_URL}{endpoint}"
            if method.upper() == 'GET':
                response = await self.http_client.get(url)
            else:
                response = await self.http_client.post(url, json=data or {})

            response.raise_for_status()
            return response.json()
        except httpx.RequestError as e:
            logger.error(f"Bot API request failed: {e}")
            return {"success": False, "error": str(e)}

    async def generate_mistral_response(self, user_message: str, context: str) -> str:
        """Generate AI response using Mistral"""
        try:
            system_prompt = f"""You are {BOT_NAME}, an intelligent Minecraft bot. You can perform actions and chat with players.

Available actions (use exact syntax):
- followPlayer("username") - Follow a player
- moveTo(x, y, z) - Move to coordinates 
- say("message") - Say something (handled automatically)
- attackEntity(entityId) - Attack an entity
- mineBlock("blockType") - Mine blocks (common types: oak_log, stone, coal_ore, iron_ore, dirt, cobblestone)
- craftItem("itemName") - Craft items
- placeBlock("blockType") - Place blocks
- collectBlock("blockType") - Collect blocks
- dropItem("itemName") - Drop items
- equipItem("itemName") - Equip items
- useItem("itemName") - Use items
- recipeItem("itemName") - Get recipe for items
- attackNearestEntity() - Attack nearest hostile entity
- defend() - Defensive stance
- flee() - Flee from danger
- stopActivity() - Stop current action

IMPORTANT: When you want to perform actions, include them in your response using the exact function syntax above. You can combine conversational text with actions.

Examples:
- "Sure, I'll follow you! followPlayer('{context.split(':')[0] if ':' in context else 'player'}')"
- "Let me come to you! followPlayer('{context.split(':')[0] if ':' in context else 'player'}')"
- "I'll mine some wood for you. mineBlock('oak_log')"
- "Looking for wood! mineBlock('oak_log')"

Current context: {context}

Recent chat messages:
{json.dumps(bot_context.recent_messages[-3:], indent=2)}

Bot state:
{json.dumps(bot_context.state, indent=2)}

Respond naturally but include appropriate action functions when needed. Be conversational and helpful."""

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]

            response = mistral_client.chat.complete(
                model="mistral-large-latest",
                messages=messages,
                max_tokens=500
            )

            # Check if response is None or empty
            content = response.choices[0].message.content
            if content is None or content.strip() == "":
                logger.warning("Mistral returned empty response, using fallback")
                return "I'll help you with that!"
            
            return content.strip()
            
        except Exception as e:
            logger.error(f"Mistral API error: {e}")
            logger.error(f"Mistral client type: {type(mistral_client)}")
            logger.error(f"Response object: {response if 'response' in locals() else 'No response'}")
            return f"Sorry, I encountered an error processing your request: {str(e)}"

    def setup_tools(self):
        """Register MCP tools that map to bot API endpoints"""

        # Define functions first, then register them
        async def move_to(x: float, y: float, z: float) -> BotResponse:
            result = await self.bot_api_request('POST', '/moveTo', {'x': x, 'y': y, 'z': z})
            if 'success' not in result:
                result['success'] = True
            if not result.get('success', False) and 'error' in result and 'message' not in result:
                result['message'] = result['error']
            return BotResponse(**result)

        async def follow_player(username: str) -> BotResponse:
            result = await self.bot_api_request('POST', '/followPlayer', {'username': username})
            if 'success' not in result:
                result['success'] = True
            if not result.get('success', False) and 'error' in result and 'message' not in result:
                result['message'] = result['error']
            return BotResponse(**result)

        async def say(message: str) -> BotResponse:
            result = await self.bot_api_request('POST', '/say', {'message': message})
            if 'success' not in result:
                result['success'] = True
            if not result.get('success', False) and 'error' in result and 'message' not in result:
                result['message'] = result['error']
            return BotResponse(**result)

        async def get_status() -> Dict[str, Any]:
            result = await self.bot_api_request('GET', '/status')
            if result.get('success', True):
                bot_context.update_state(result)
            return result

        async def craft_item(item: str, quantity: int = 1) -> BotResponse:
            result = await self.bot_api_request('POST', '/craft', {'item': item, 'quantity': quantity})
            return BotResponse(**result)

        async def mine_block(blockType: str, count: int = 1) -> BotResponse:
            result = await self.bot_api_request('POST', '/mine', {'blockType': blockType, 'count': count})
            return BotResponse(**result)
        
        async def place_block(blockType: str, count: int = 1) -> BotResponse:
            result = await self.bot_api_request('POST', '/place', {'blockType': blockType, 'count': count})
            # Ensure we always have a success field
            if 'success' not in result:
                result['success'] = result.get('placed', False)
            # Convert error to message for failed responses  
            if not result.get('success', False) and 'error' in result and 'message' not in result:
                result['message'] = result['error']
            return BotResponse(**result)

        async def collect_block(blockType: str, count: int = 1) -> BotResponse:
            result = await self.bot_api_request('POST', '/collect', {'blockType': blockType, 'count': count})
            # Ensure we always have a success field
            if 'success' not in result:
                result['success'] = True  # assume success if no explicit success field
            # Convert error to message for failed responses
            if not result.get('success', False) and 'error' in result and 'message' not in result:
                result['message'] = result['error']
            return BotResponse(**result)
        
        async def drop_item(item: str, count: int = 1) -> BotResponse:
            result = await self.bot_api_request('POST', '/drop', {'item': item, 'count': count})
            return BotResponse(**result)
        
        async def equip_item(item: str) -> BotResponse:
            result = await self.bot_api_request('POST', '/equip', {'item': item})
            return BotResponse(**result)

        async def recipe_item(item: str) -> BotResponse:
            result = await self.bot_api_request('POST', '/recipe', {'item': item})
            return BotResponse(**result)

        async def attack_nearest_entity() -> BotResponse:
            result = await self.bot_api_request('POST', '/attackNearest')
            return BotResponse(**result)
        
        async def defend() -> BotResponse:
            result = await self.bot_api_request('POST', '/defend')
            return BotResponse(**result)
        
        async def flee() -> BotResponse:
            result = await self.bot_api_request('POST', '/flee')
            return BotResponse(**result)
        
        async def use_item(item: str) -> BotResponse:
            result = await self.bot_api_request('POST', '/use', {'item': item})
            return BotResponse(**result)

        async def attack_entity(entityId: int) -> BotResponse:
            result = await self.bot_api_request('POST', '/attack', {'entityId': entityId})
            return BotResponse(**result)

        async def stop_activity() -> BotResponse:
            result = await self.bot_api_request('POST', '/stop')
            return BotResponse(**result)

        async def process_chat_command(username: str, message: str) -> str:
            return await self.process_chat_internal(username, message)

        # Store references to the functions for internal use BEFORE registering them
        self.move_to = move_to
        self.follow_player = follow_player
        self.say = say
        self.get_status = get_status
        self.craft_item = craft_item
        self.mine_block = mine_block
        self.place_block = place_block
        self.collect_block = collect_block
        self.drop_item = drop_item
        self.equip_item = equip_item
        self.recipe_item = recipe_item
        self.attack_nearest_entity = attack_nearest_entity
        self.defend = defend    
        self.flee = flee
        self.use_item = use_item
        self.attack_entity = attack_entity
        self.stop_activity = stop_activity
        self.process_chat_command = process_chat_command

        # Now register them as MCP tools
        self.mcp.tool()(move_to)
        self.mcp.tool()(follow_player)
        self.mcp.tool()(say)
        self.mcp.tool()(get_status)
        self.mcp.tool()(craft_item)
        self.mcp.tool()(mine_block)
        self.mcp.tool()(place_block)
        self.mcp.tool()(collect_block)
        self.mcp.tool()(drop_item)
        self.mcp.tool()(equip_item)
        self.mcp.tool()(recipe_item)
        self.mcp.tool()(attack_nearest_entity)
        self.mcp.tool()(defend)
        self.mcp.tool()(flee)
        self.mcp.tool()(use_item)
        self.mcp.tool()(attack_entity)
        self.mcp.tool()(stop_activity)
        self.mcp.tool()(process_chat_command)

    async def process_chat_internal(self, username: str, message: str) -> str:
        """Internal chat processing logic"""
        bot_context.add_message(username, message)

        if not (message.lower().startswith(BOT_NAME.lower()) or BOT_NAME.lower() in message.lower()):
            return ""

        clean_message = message
        for prefix in [f"{BOT_NAME} ", f"{BOT_NAME}, ", f"{BOT_NAME}:"]:
            clean_message = clean_message.replace(prefix, "", 1)
        clean_message = clean_message.strip()

        status = await self.get_status()
        lower_msg = clean_message.lower()

        # Handle simple commands first
        if any(word in lower_msg for word in ['health', 'status', 'how are you']):
            health = status.get('health', 0)
            food = status.get('food', 0)
            pos = status.get('position', {})
            await self.say(f"I'm at {health}/20 health, {food}/20 food. Position: {pos.get('x', 0):.1f}, {pos.get('y', 0):.1f}, {pos.get('z', 0):.1f}")
            return "Status reported"

        elif 'follow me' in lower_msg or f'follow {username}' in lower_msg:
            result = await self.follow_player(username)
            message = result.message_or_error if isinstance(result, BotResponse) else str(result)
            success = result.success if isinstance(result, BotResponse) else True
            await self.say(f"Following {username}!" if success else f"Can't follow: {message}")
            return "Follow command executed"

        elif 'stop' in lower_msg:
            await self.stop_activity()
            await self.say("Stopped!")
            return "Stop command executed"

        elif any(word in lower_msg for word in ['come here', 'come to me']):
            await self.say(f"I'll try to come to you, {username}!")
            return "Come command acknowledged"

        # For complex commands, use AI + action parsing
        context = f"Player {username} said: {clean_message}"
        ai_response = await self.generate_mistral_response(clean_message, context)
        
        # Parse and execute actions from AI response
        await self.parse_and_execute_actions(ai_response, username)
        
        # Send the conversational part as chat
        clean_response = self.extract_conversational_response(ai_response)
        if clean_response.strip():
            await self.say(clean_response)
        
        return f"AI response processed: {ai_response}"

    async def parse_and_execute_actions(self, ai_response: str, username: str):
        """Parse AI response and execute any actions found"""
        # Handle None response
        if ai_response is None:
            return []
            
        import re
        
        # Define action patterns with correct mappings
        action_patterns = {
            r'followPlayer\("([^"]+)"\)|followPlayer\(([^,)]+)\)': self.execute_follow_player,
            r'moveTo\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)': self.execute_move_to,
            r'attack\((\d+)\)|attackEntity\((\d+)\)': self.execute_attack_entity,
            r'mine\("([^"]+)"\)|mineBlock\("([^"]+)"\)': self.execute_mine_block,
            r'place\("([^"]+)"\)|placeBlock\("([^"]+)"\)': self.execute_place_block,
            r'collect\("([^"]+)"\)|collectBlock\("([^"]+)"\)': self.execute_collect_block,
            r'drop\("([^"]+)"\)|dropItem\("([^"]+)"\)': self.execute_drop_item,
            r'equip\("([^"]+)"\)|equipItem\("([^"]+)"\)': self.execute_equip_item,
            r'recipe\("([^"]+)"\)|recipeItem\("([^"]+)"\)': self.execute_recipe_item,
            r'use\("([^"]+)"\)|useItem\("([^"]+)"\)': self.execute_use_item,
            r'craft\("([^"]+)"\)|craftItem\("([^"]+)"\)': self.execute_craft_item,
            r'attackNearestEntity\(\)': self.execute_attack_nearest_entity,
            r'defend\(\)': self.execute_defend,
            r'flee\(\)': self.execute_flee,
            r'stop\(\)|stopActivity\(\)': self.execute_stop_activity,
        }
        
        actions_executed = []
        
        for pattern, action_func in action_patterns.items():
            matches = re.finditer(pattern, ai_response, re.IGNORECASE)
            for match in matches:
                try:
                    result = await action_func(match, username)
                    actions_executed.append(result)
                    logger.info(f"Executed action from AI: {match.group(0)} -> {result}")
                except Exception as e:
                    error_msg = f"Failed to execute {match.group(0)}: {str(e)}"
                    logger.error(error_msg)
                    actions_executed.append(error_msg)
        
        # Special handling for follow me commands in natural language
        if any(phrase in ai_response.lower() for phrase in ['i will follow', 'following you', 'coming to you']):
            try:
                result = await self.follow_player(username)
                message = result.message_or_error if isinstance(result, BotResponse) else str(result)
                action_result = f"followPlayer({username}): {message}"
                actions_executed.append(action_result)
                logger.info(f"Executed natural language follow command for {username}")
            except Exception as e:
                error_msg = f"Failed to execute follow command: {str(e)}"
                logger.error(error_msg)
                actions_executed.append(error_msg)
        
        return actions_executed

    # Execution methods for action parsing
    async def execute_follow_player(self, match, username: str):
        target = match.group(1) or match.group(2) or username
        target = target.strip()
        result = await self.follow_player(target)
        return f"followPlayer({target}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_move_to(self, match, username: str):
        x, y, z = float(match.group(1)), float(match.group(2)), float(match.group(3))
        result = await self.move_to(x, y, z)
        return f"moveTo({x}, {y}, {z}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_attack_entity(self, match, username: str):
        entity_id = int(match.group(1) or match.group(2))
        result = await self.attack_entity(entity_id)
        return f"attackEntity({entity_id}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_mine_block(self, match, username: str):
        block_type = match.group(1) or match.group(2)
        result = await self.mine_block(block_type)
        
        # Add detailed feedback for mining
        if isinstance(result, BotResponse):
            if not result.success:
                await self.say(f"I couldn't find any {block_type} blocks nearby. Maybe you need to show me where they are?")
            elif result.data and 'mined' in str(result.data):
                mined_count = result.data.get('mined', 0) if isinstance(result.data, dict) else 0
                if mined_count > 0:
                    await self.say(f"Successfully mined {mined_count} {block_type}!")
                else:
                    await self.say(f"I couldn't find any {block_type} blocks to mine.")
        
        return f"mineBlock({block_type}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_place_block(self, match, username: str):
        block_type = match.group(1) or match.group(2)
        result = await self.place_block(block_type)
        
        # Add user feedback for place operations
        if isinstance(result, BotResponse):
            if result.success:
                await self.say(f"Placed {block_type} successfully!")
            else:
                await self.say(f"Failed to place {block_type}: {result.message_or_error}")
        
        return f"placeBlock({block_type}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_collect_block(self, match, username: str):
        block_type = match.group(1) or match.group(2)
        result = await self.collect_block(block_type)
        return f"collectBlock({block_type}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"
    
    async def execute_drop_item(self, match, username: str):
        item = match.group(1) or match.group(2)
        result = await self.drop_item(item)
        return f"dropItem({item}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_equip_item(self, match, username: str):
        item = match.group(1) or match.group(2)
        result = await self.equip_item(item)
        return f"equipItem({item}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_recipe_item(self, match, username: str):
        item = match.group(1) or match.group(2)
        result = await self.recipe_item(item)
        return f"recipeItem({item}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_use_item(self, match, username: str):
        item = match.group(1) or match.group(2)
        result = await self.use_item(item)
        return f"useItem({item}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_craft_item(self, match, username: str):
        item = match.group(1) or match.group(2)
        result = await self.craft_item(item)
        return f"craftItem({item}): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_attack_nearest_entity(self, match, username: str):
        result = await self.attack_nearest_entity()
        return f"attackNearestEntity(): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_defend(self, match, username: str):
        result = await self.defend()
        return f"defend(): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_flee(self, match, username: str):
        result = await self.flee()
        return f"flee(): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    async def execute_stop_activity(self, match, username: str):
        result = await self.stop_activity()
        return f"stopActivity(): {result.message_or_error if isinstance(result, BotResponse) else str(result)}"

    def extract_conversational_response(self, ai_response: str) -> str:
        """Extract the conversational part from AI response, removing action calls"""
        import re
        
        # Remove action patterns
        action_patterns = [
            r'followPlayer\([^)]+\)',
            r'moveTo\([^)]+\)',
            r'attack\([^)]+\)',
            r'attackEntity\([^)]+\)',
            r'mine\([^)]+\)',
            r'mineBlock\([^)]+\)',
            r'collect\([^)]+\)',
            r'collectBlock\([^)]+\)',
            r'place\([^)]+\)',
            r'placeBlock\([^)]+\)',
            r'drop\([^)]+\)',
            r'dropItem\([^)]+\)',
            r'equip\([^)]+\)',
            r'equipItem\([^)]+\)',
            r'use\([^)]+\)',
            r'useItem\([^)]+\)',
            r'recipe\([^)]+\)',
            r'recipeItem\([^)]+\)',
            r'craft\([^)]+\)',
            r'craftItem\([^)]+\)',
            r'attackNearestEntity\(\)',
            r'defend\(\)',
            r'flee\(\)',
            r'stop\(\)',
            r'stopActivity\(\)',
        ]
        
        clean_response = ai_response
        for pattern in action_patterns:
            clean_response = re.sub(pattern, '', clean_response, flags=re.IGNORECASE)
        
        # Clean up extra whitespace and punctuation
        clean_response = re.sub(r'\s+', ' ', clean_response).strip()
        return clean_response

    async def setup_websocket_connection(self):
        @sio.event
        async def connect():
            logger.info("Connected to bot API WebSocket")

        @sio.event
        async def disconnect():
            logger.info("Disconnected from bot API WebSocket")

        @sio.event
        async def bot_state(data):
            bot_context.update_state(data)
            logger.debug(f"Bot state updated: {data}")

        @sio.event
        async def chat_message(data):
            username = data.get('username')
            message = data.get('message')
            if username != BOT_NAME:
                try:
                    # Call the internal processing function
                    response = await self.process_chat_internal(username, message)
                    logger.info(f"Processed chat from {username}: {message} -> {response}")
                except Exception as e:
                    logger.error(f"Error processing chat: {e}")

        @sio.event
        async def error(data):
            logger.error(f"Bot API error: {data}")

        @sio.event
        async def goal_reached(data):
            logger.info(f"Goal reached: {data}")

        try:
            await sio.connect(f"{BOT_API_URL.replace('http', 'ws')}")
        except Exception as e:
            logger.error(f"Failed to connect to WebSocket: {e}")

    def run_mcp_server(self):
        """Run MCP server in a separate thread"""
        def mcp_thread():
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                logger.info("Starting MCP server in separate thread...")
                loop.run_until_complete(self.mcp.run())
            except Exception as e:
                logger.error(f"MCP server error: {e}")
            finally:
                loop.close()

        # Start MCP server in a separate thread
        mcp_thread_obj = threading.Thread(target=mcp_thread, daemon=True)
        mcp_thread_obj.start()
        return mcp_thread_obj

    async def start(self):
        # Start MCP server in separate thread first
        mcp_thread = self.run_mcp_server()
        
        # Give the MCP server a moment to start
        await asyncio.sleep(1)
        
        # Then setup WebSocket connection in main thread
        await self.setup_websocket_connection()
        
        # Keep the main thread alive
        logger.info("Bot server started successfully!")
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            await sio.disconnect()
            await self.http_client.aclose()


async def main():
    server = MCPBotServer()
    await server.start()

if __name__ == "__main__":
    asyncio.run(main())