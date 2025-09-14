# Bridge Server API Documentation

## /bot
### GET /status
- **Description:** Get the bot's current status.
- **Request:** None
- **Response:**
  - `status`: Bot status object (from `bot.getStatus()`).

---

## /chat
### POST /say
- **Description:** Make the bot send a chat message.
- **Request Body:**
  ```json
  {
    "message": "string" // Required, non-empty
  }
  ```
- **Response:** Success message or error.

---

## /crafting
### POST /item
- **Description:** Craft a specific item.
- **Request Body:**
  ```json
  {
    "item": "string", // Required, non-empty
    "count": number    // Optional, defaults to 1
  }
  ```
- **Response:** Crafting result or error.

---

## /health
### GET /
- **Description:** Get the bot's health and server status.
- **Request:** None
- **Response:**
  ```json
  {
    "server": "online",
    "bot": "connected" | "disconnected"
  }
  ```

---

## /inventory
### GET /
- **Description:** Get the bot's inventory.
- **Request:** None
- **Response:**
  ```json
  {
    "totalItems": number,
    "items": [ ... ] // Array of inventory items
  }
  ```

---

## /mining
### POST /block
- **Description:** Mine a specific block.
- **Request Body:**
  ```json
  {
    "blockType": "string", // Required, non-empty
    "maxDistance": number   // Optional, defaults to 32
  }
  ```
- **Response:** Mining result or error.

---

## /movement
### POST /moveTo
- **Description:** Move the bot to a specific location.
- **Request Body:**
  ```json
  {
    "x": number, // Required
    "y": number, // Required
    "z": number  // Required
  }
  ```
- **Response:** Movement result or error.

### POST /follow
- **Description:** Make the bot follow a player.
- **Request Body:**
  ```json
  {
    "playerName": "string", // Required, non-empty
    "distance": number      // Optional, 1-10, defaults to 3
  }
  ```
- **Response:** Follow result or error.

### POST /stop
- **Description:** Stop the bot's movement.
- **Request:** None
- **Response:** Stop result or error.

### GET /position
- **Description:** Get the bot's current position.
- **Request:** None
- **Response:** Position object.

---
### GET /give
- Description: Give items to a player via server command (requires bot to be OP). Supports optional enchantments for tools.
- Query Params:
  - `player`: string (required) — target player name
  - `item`: string (required) — item id or short name (e.g., `diamond_sword` or `minecraft:diamond_sword`)
  - `count`: number (optional) — 1..64, defaults to 1
  - `enchant`: string[] (optional, repeatable) — enchantments as `id:level` (e.g., `sharpness:5`, `minecraft:unbreaking:3`)
- Response: Details of the command and server output

Examples:
```
GET /crafting/give?player=Alex&item=diamond_sword&count=1&enchant=sharpness:5&enchant=unbreaking:3
GET /crafting/give?player=Alex&item=minecraft:emerald&count=10
```

---

## /quest
### POST /
- Description: Activate the planks quest (default target 8). Keeps running until the bot has gained at least the target number of wooden planks since activation. Sends a chat message on start and "Bravo" on completion. Rewards the specified player with 10 emeralds via `/give` when completed (bot must be op).
  Upon completion, the quest consumes up to the target number of planks gained since activation from the bot inventory (planks only).
- Request Body:
  ```json
  {
    "target": 8,            // Optional, default 8
    "assistCrafting": true, // Optional, default true; bot tries crafting planks from logs if possible
    "playerName": "YourName" // Required, player to reward with emeralds on success
  }
  ```
- Response: Current quest status.

### GET /status
- Description: Get current quest status (active, baseline, current, gained, target, completed).

### POST /stop
- Description: Stop the quest monitoring loop and reset active state.

---

## New DM/Quests/World/Actions APIs

### /dm
- POST `/dm/chat` body: `{ "playerName": "Alex", "message": "je veux une quête" }`
- POST `/dm/tool-calls` body: `{ "calls": [ {"tool":"propose_quest","args":{"playerName":"Alex"}} ] }`
- POST `/dm/persona` body: `{ "persona": "wise_cat", "temperature": 0.6 }`
- GET  `/dm/context?playerName=Alex`

### /quests
- POST `/quests/generate` body: `{ "playerName": "Alex", "seed?": "...", "biomeBias?": ["plains"], "difficulty?": "normal" }`
- POST `/quests/:id/start`
- POST `/quests/:id/accept`
- POST `/quests/:id/decline`
- GET  `/quests/:id/status`
- POST `/quests/:id/branch` body: `{ "choice": "sauver_villageois" }`
- POST `/quests/:id/stop`
- POST `/quests/:id/reward`

### /world
- GET `/world/snapshot?around=Alex&radius=32`

### /actions
- POST `/actions/spawn` body: `{ "type":"minecraft:skeleton", "count":1, "near": { "playerName":"Alex", "radius":5 } }`
- POST `/actions/grant` body: `{ "playerName":"Alex", "items":[{"itemId":"minecraft:emerald","count":10}] }`
- POST `/actions/effect` body: `{ "playerName":"Alex","effectId":"minecraft:speed","durationSec":30,"amplifier":1 }`
- POST `/actions/waypoint` body: `{ "playerName":"Alex","x":0,"y":64,"z":0,"label":"Objectif" }`

### /events (SSE)
- GET `/events` – flux d’événements: `dm_say`, `quest_started`, `quest_succeeded`, `quest_failed`, `quest_updated`.


## Notes
- All endpoints return a standard response format with success/error and message.
- Some endpoints (e.g., `/whisper`, `/history`, `/recipes`, `/area`, `/vein`) are planned but not yet implemented.
