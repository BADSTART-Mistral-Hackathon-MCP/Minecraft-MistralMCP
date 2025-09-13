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

## Notes
- All endpoints return a standard response format with success/error and message.
- Some endpoints (e.g., `/whisper`, `/history`, `/recipes`, `/area`, `/vein`) are planned but not yet implemented.
