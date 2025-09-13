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
PORT=3001                         # Bridge server port
MC_HOST=localhost                 # Minecraft server host
MC_PORT=25565                     # Minecraft server port
MC_VERSION=1.21.1                 # Minecraft version

# Auth mode: 'offline' (local dev server) or 'microsoft' (online)
MC_AUTH=offline

# Offline auth username used in-game
MC_USERNAME=BridgeBot

# For Microsoft auth, optional Microsoft account email (no password required)
# MC_EMAIL=you@example.com
# Optional token cache dir (created automatically)
# MC_PROFILES_DIR=.minecraft-profiles
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

## Microsoft Account Login

Set `MC_AUTH=microsoft` in `.env`. On first run, the server prints a device code to authenticate:

1. Start the server (`npm run dev` or `npm start`).
2. In the logs, follow the instructions:
   - Open the verification URL (usually `https://www.microsoft.com/link`).
   - Enter the displayed code.
3. Tokens are cached in `.minecraft-profiles/` (or `MC_PROFILES_DIR`) so next runs won’t require login.

Notes:
- No password is used with Microsoft login (OAuth device code flow).
- Optionally set `MC_EMAIL` to hint the account that should be used.

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

- ✅ **Auto-reconnection** with exponential backoff
- ✅ **Pathfinding** for intelligent movement
- ✅ **Error handling** with consistent API responses
- ✅ **TypeScript** for better development experience
- ✅ **Clean architecture** with separated concerns
- ✅ **Minimal dependencies** for easy deployment

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
