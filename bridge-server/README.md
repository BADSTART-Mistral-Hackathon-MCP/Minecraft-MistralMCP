# Minecraft Bot Bridge Server

A clean and simple HTTP API server for controlling a Minecraft bot using Mineflayer. Designed to work with MCP (Model Context Protocol) servers.

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your Minecraft server details
```

3. **Run in development:**
```bash
npm run dev
```

4. **Build and run in production:**
```bash
npm run build
npm start
```

## Configuration

Edit `.env` file:

```env
PORT=3001                    # Bridge server port
MC_HOST=localhost            # Minecraft server host
MC_PORT=25565               # Minecraft server port
MC_USERNAME=BridgeBot       # Bot username
MC_PASSWORD=your_password   # Microsoft account password (optional)
MC_VERSION=1.21.1           # Minecraft version
```

## API Endpoints

### Health Check
```http
GET /health
```
Returns server and bot connection status.

### Bot Status
```http
GET /bot/status
```
Returns detailed bot information (health, position, inventory count, etc.).

### Move Bot
```http
POST /movement/moveTo
Content-Type: application/json

{
  "x": 100,
  "y": 64,
  "z": 100
}
```

### Make Bot Speak
```http
POST /chat/say
Content-Type: application/json

{
  "message": "Hello, world!"
}
```

### Mine Blocks
```http
POST /mining/block
Content-Type: application/json

{
  "blockType": "stone",
  "maxDistance": 32
}
```

### Craft Items
```http
POST /crafting/item
Content-Type: application/json

{
  "item": "wooden_pickaxe",
  "count": 1
}
```

### Get Inventory
```http
GET /inventory
```
Returns bot's current inventory contents.

### Give Items (with optional enchantments)
```http
GET /crafting/give?player=Alex&item=diamond_sword&count=1&enchant=sharpness:5&enchant=unbreaking:3
```
- Requires the bot to be OP
- `player`: target player
- `item`: `diamond_sword` or `minecraft:diamond_sword`
- `count`: 1..64
- `enchant`: repeatable `id:level` strings (e.g., `sharpness:5`)

### Planks Quest
```http
POST /quest
Content-Type: application/json

{
  "target": 8,
  "assistCrafting": true,
  "playerName": "YourName"
}
```
Starts a quest that completes when the bot has gained at least 8 wooden planks since activation. On start the bot says: "tu doit me fournir 8 item de planches de bois" and on completion it says: "Bravo". It also rewards `playerName` with 10 emeralds using `/give` (the bot must be OP). After completion, the quest consumes (removes from inventory) up to the target count of planks credited to the quest.

```http
GET /quest/status
```
Returns quest status.

```http
POST /quest/stop
```
Stops the quest.

## Response Format

All endpoints return responses in this format:

```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... },
  "error": "Error message if failed"
}
```

## Features

- ✅ **Auto-reconnection** with retry loop
- ✅ **Pathfinding** for intelligent movement
- ✅ **Error handling** with consistent API responses
- ✅ **TypeScript** for better development experience
- ✅ **Clean architecture** with separated concerns
- ✅ **Minimal dependencies** for easy deployment
- ✅ **Quest monitoring** for wooden planks with optional auto-crafting assist

## Usage with MCP

This bridge server is designed to work with MCP servers that need to control Minecraft bots. The Python MCP server can make HTTP requests to these endpoints to control the bot.

Example Python MCP integration:
```python
import httpx

class MinecraftMCP:
    def __init__(self, bridge_url="http://localhost:3001"):
        self.bridge_url = bridge_url
        self.client = httpx.Client()
    
    async def move_bot(self, x: int, y: int, z: int):
        response = await self.client.post(
            f"{self.bridge_url}/move",
            json={"x": x, "y": y, "z": z}
        )
        return response.json()
```

## Development

- `yarn dev` - Start in development mode with hot reload
- `yarn build` - Build TypeScript to JavaScript
- `yarn clean` - Clean build directory

## Troubleshooting

1. **Bot won't connect**: Check MC_HOST, MC_PORT, and MC_VERSION in .env
2. **Authentication issues**: Ensure MC_PASSWORD is correct for Microsoft accounts
3. **API errors**: Check server logs for detailed error messages
4. **Movement fails**: Ensure pathfinding can find a route to the destination
