# McQuest Enhanced

McQuest Enhanced is an advanced HTTP bridge that connects to a Minecraft server with Mineflayer and exposes both basic and intelligent REST APIs for automation. It features artificial intelligence, advanced pathfinding, and comprehensive error handling for autonomous bot operation.

## Features

- 🤖 **Artificial Intelligence**: Environment analysis, autonomous decision-making, goal management
- 🗺️ **Advanced Pathfinding**: Safe routes, alternative paths, intelligent navigation
- 🛡️ **Error Handling**: Comprehensive error recovery, statistics, and logging
- 🔄 **Auto Mode**: Fully autonomous operation with intelligent behavior
- 💾 **Memory System**: Persistent information storage and learning
- 📊 **Enhanced API**: Extended endpoints with intelligence and safety features

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Configure your `.env` file:
```env
PORT=3003                    # Bridge server port
MC_HOST=localhost            # Minecraft server host
MC_PORT=25565               # Minecraft server port
MC_USERNAME=McQuestBot      # Bot username
MC_PASSWORD=your_password   # Microsoft account password (optional)
MC_VERSION=1.21.1           # Minecraft version
```

The server will automatically connect to your Minecraft server and initialize all enhanced features.

## Basic API (Original)

### Health & Status
```bash
# Health check
curl http://localhost:3003/health

# Bot status and vitals
curl http://localhost:3003/bot/status

# Bot position and rotation
curl http://localhost:3003/bot/position
```

### Communication
```bash
# Send chat message
curl -X POST http://localhost:3003/bot/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello world!"}'
```

### Movement
```bash
# Move to coordinates
curl -X POST http://localhost:3003/bot/move \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 64, "z": 100}'

# Follow player
curl -X POST http://localhost:3003/bot/follow \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Player1", "distance": 3}'

# Stop movement
curl -X POST http://localhost:3003/bot/stop

# Look at player
curl -X POST http://localhost:3003/bot/look \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Player1"}'
```

### Actions
```bash
# Mine blocks
curl -X POST http://localhost:3003/bot/mine \
  -H "Content-Type: application/json" \
  -d '{"blockType": "stone", "maxDistance": 32}'

# Craft items
curl -X POST http://localhost:3003/bot/craft \
  -H "Content-Type: application/json" \
  -d '{"item": "wooden_pickaxe", "count": 1}'

# Get inventory
curl http://localhost:3003/bot/inventory

# Drop items
curl -X POST http://localhost:3003/bot/inventory/drop \
  -H "Content-Type: application/json" \
  -d '{"itemName": "dirt", "count": 10}'
```

## Enhanced Intelligence API

### Environment Analysis
```bash
# Analyze environment (32 block radius)
curl http://localhost:3003/intelligence/analyze-environment

# Analyze larger area (64 block radius)
curl "http://localhost:3003/intelligence/analyze-environment?radius=64"
```

### Autonomous Decision Making
```bash
# Make intelligent decision
curl -X POST http://localhost:3003/intelligence/make-decision

# Execute specific intelligent action
curl -X POST http://localhost:3003/intelligence/execute-action \
  -H "Content-Type: application/json" \
  -d '{"action": "seek_safety", "parameters": {"urgency": "high"}}'

# Enable auto mode (5 minutes)
curl -X POST http://localhost:3003/intelligence/auto-mode \
  -H "Content-Type: application/json" \
  -d '{"duration": 300000}'
```

### Goal Management
```bash
# Add goal
curl -X POST http://localhost:3003/intelligence/goals \
  -H "Content-Type: application/json" \
  -d '{"goal": "Build a house"}'

# Remove goal
curl -X DELETE http://localhost:3003/intelligence/goals \
  -H "Content-Type: application/json" \
  -d '{"goal": "Build a house"}'

# Get all goals
curl http://localhost:3003/intelligence/goals
```

### Memory System
```bash
# Store memory
curl -X POST http://localhost:3003/intelligence/memory \
  -H "Content-Type: application/json" \
  -d '{"key": "home_base", "value": {"x": 100, "y": 64, "z": 100, "description": "Main base location"}}'

# Retrieve memory
curl http://localhost:3003/intelligence/memory/home_base
```

## Advanced Pathfinding API

### Enhanced Path Finding
```bash
# Find enhanced path with options
curl -X POST http://localhost:3003/pathfinding/enhanced-path \
  -H "Content-Type: application/json" \
  -d '{
    "x": 100, "y": 64, "z": 100,
    "options": {
      "avoidDanger": true,
      "optimizeForSpeed": false,
      "allowBreaking": false
    }
  }'

# Find safe path
curl -X POST http://localhost:3003/pathfinding/safe-path \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 64, "z": 100}'

# Find fast path (allows breaking/placing)
curl -X POST http://localhost:3003/pathfinding/fast-path \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 64, "z": 100}'

# Find alternative paths
curl -X POST http://localhost:3003/pathfinding/alternative-paths \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 64, "z": 100, "count": 3}'
```

### Specialized Navigation
```bash
# Find path to nearest block
curl -X POST http://localhost:3003/pathfinding/path-to-block \
  -H "Content-Type: application/json" \
  -d '{"blockType": "iron_ore", "maxDistance": 64}'

# Find path to player
curl -X POST http://localhost:3003/pathfinding/path-to-player \
  -H "Content-Type: application/json" \
  -d '{"playerName": "Player1"}'

# Find path to safety
curl -X POST http://localhost:3003/pathfinding/path-to-safety

# Enhanced movement with safety
curl -X POST http://localhost:3003/pathfinding/move-enhanced \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 64, "z": 100, "safe": true}'
```

## Error Handling API

### Error Monitoring
```bash
# Get error history (last 50)
curl http://localhost:3003/errors/history

# Get recent errors (last 10)
curl http://localhost:3003/errors/recent

# Get error statistics
curl http://localhost:3003/errors/stats

# Get error handling capabilities
curl http://localhost:3003/errors/capabilities
```

### Error Management
```bash
# Clear error history
curl -X DELETE http://localhost:3003/errors/history

# Test error handling
curl -X POST http://localhost:3003/errors/test \
  -H "Content-Type: application/json" \
  -d '{"errorType": "test", "message": "Manual error test"}'
```

## Enhanced Actions API

### Intelligent Actions
```bash
# Enhanced mining (with intelligence)
curl -X POST http://localhost:3003/enhanced/mine \
  -H "Content-Type: application/json" \
  -d '{"blockType": "diamond_ore", "maxDistance": 64}'

# Enhanced crafting (with material analysis)
curl -X POST http://localhost:3003/enhanced/craft \
  -H "Content-Type: application/json" \
  -d '{"item": "diamond_pickaxe", "count": 1}'
```

### System Information
```bash
# Get enhanced status (complete system info)
curl http://localhost:3003/enhanced/status

# Perform system diagnostics
curl http://localhost:3003/enhanced/system-check

# Get system capabilities
curl http://localhost:3003/enhanced/capabilities
```

## Survival & Combat API

### Survival System
```bash
# Start survival mode (wood -> tools -> stone -> mining)
curl -X POST http://localhost:3003/survival/start

# Stop survival mode
curl -X POST http://localhost:3003/survival/stop

# Get survival state
curl http://localhost:3003/survival/status

# Smart mining with automatic tool preparation
curl -X POST http://localhost:3003/survival/smart-mining \
  -H "Content-Type: application/json" \
  -d '{"blockType": "iron_ore", "quantity": 20}'

# Execute custom mining plan
curl -X POST http://localhost:3003/survival/mining-plan \
  -H "Content-Type: application/json" \
  -d '{
    "targetBlock": "diamond_ore",
    "safeDepth": 32,
    "lightingRequired": true,
    "supportStructure": true,
    "escapeRoute": true
  }'
```

### Combat System
```bash
# Enable combat mode (defensive by default)
curl -X POST http://localhost:3003/combat/enable \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "selfDefenseMode": true,
      "maxAttackDistance": 4,
      "healthThreshold": 6
    }
  }'

# Enable aggressive mode (attacks all players)
curl -X POST http://localhost:3003/combat/aggressive

# Enable aggressive mode targeting specific player
curl -X POST http://localhost:3003/combat/aggressive \
  -H "Content-Type: application/json" \
  -d '{"targetPlayer": "SPENDLYYY"}'

# Enable retaliation mode (attacks back when hit)
curl -X POST http://localhost:3003/combat/retaliation

# Attack specific player
curl -X POST http://localhost:3003/combat/attack \
  -H "Content-Type: application/json" \
  -d '{"playerName": "SPENDLYYY"}'

# Disable combat mode
curl -X POST http://localhost:3003/combat/disable

# Get combat status
curl http://localhost:3003/combat/status

# Update combat settings
curl -X PUT http://localhost:3003/combat/settings \
  -H "Content-Type: application/json" \
  -d '{
    "maxAttackDistance": 6,
    "healthThreshold": 10,
    "fleeWhenLowHealth": true
  }'

# Clear recent attackers list
curl -X DELETE http://localhost:3003/combat/attackers
```

## Testing Workflows

### 1. Basic Bot Test
```bash
# Check bot health
curl http://localhost:3003/health

# Get bot status
curl http://localhost:3003/bot/status

# Simple movement
curl -X POST http://localhost:3003/bot/move \
  -H "Content-Type: application/json" \
  -d '{"x": 100, "y": 64, "z": 100}'
```

### 2. Intelligence Test
```bash
# Analyze environment
curl http://localhost:3003/intelligence/analyze-environment

# Make a decision
curl -X POST http://localhost:3003/intelligence/make-decision

# Set a goal
curl -X POST http://localhost:3003/intelligence/goals \
  -H "Content-Type: application/json" \
  -d '{"goal": "Explore the area"}'

# Enable auto mode for 1 minute
curl -X POST http://localhost:3003/intelligence/auto-mode \
  -H "Content-Type: application/json" \
  -d '{"duration": 60000}'
```

### 3. Advanced Pathfinding Test
```bash
# Find safe path
curl -X POST http://localhost:3003/pathfinding/safe-path \
  -H "Content-Type: application/json" \
  -d '{"x": 150, "y": 64, "z": 150}'

# Find path to safety
curl -X POST http://localhost:3003/pathfinding/path-to-safety

# Find alternative routes
curl -X POST http://localhost:3003/pathfinding/alternative-paths \
  -H "Content-Type: application/json" \
  -d '{"x": 200, "y": 64, "z": 200, "count": 3}'
```

### 4. Error Handling Test
```bash
# Check error stats
curl http://localhost:3003/errors/stats

# Test error handling
curl -X POST http://localhost:3003/errors/test \
  -H "Content-Type: application/json" \
  -d '{"errorType": "pathfinding", "message": "Test pathfinding error"}'

# Check recent errors
curl http://localhost:3003/errors/recent
```

### 5. Survival & Combat Test
```bash
# Test survival system
curl -X POST http://localhost:3003/survival/start

# Check survival progress
curl http://localhost:3003/survival/status

# Test combat system
curl -X POST http://localhost:3003/combat/retaliation

# Check combat status
curl http://localhost:3003/combat/status

# Test smart mining
curl -X POST http://localhost:3003/survival/smart-mining \
  -H "Content-Type: application/json" \
  -d '{"blockType": "stone", "quantity": 10}'
```

### 6. Full System Test
```bash
# System diagnostics
curl http://localhost:3003/enhanced/system-check

# Enhanced status (includes all systems)
curl http://localhost:3003/enhanced/status

# System capabilities
curl http://localhost:3003/enhanced/capabilities
```

## Response Format

All endpoints return consistent JSON responses:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* response data */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Descriptive error message"
}
```

## Available Intelligent Actions

When using `/intelligence/execute-action`, these actions are available:

- `seek_safety` - Find and move to safe location
- `find_food` - Locate and consume food
- `gather_resources` - Collect valuable resources
- `avoid_threats` - Escape from dangerous situations
- `social_interaction` - Interact with nearby players
- `explore` - Explore the world intelligently

## Project Structure

```
mcquest-minimal/
  src/
    bot/
      BotGateway.ts           # Main bot interface (enhanced)
      BotIntelligence.ts      # AI decision making
      PathfindingEnhanced.ts  # Advanced navigation
      ErrorHandling.ts        # Error management
    http/
      controllers/            # API endpoint controllers
      middleware/             # Request processing
      routes.ts              # Route definitions
    config.ts                # Environment configuration
    index.ts                 # Application entry point
  ENHANCED_API.md            # Complete API documentation
  SUMMARY.md                 # Implementation overview
```

## Advanced Features

- **Environment Scanning**: 360-degree analysis up to 128 blocks
- **Threat Detection**: Automatic danger identification and avoidance
- **Resource Intelligence**: Smart resource prioritization and collection
- **Memory Persistence**: Learn and remember information across sessions
- **Goal Tracking**: Set and achieve long-term objectives
- **Auto Recovery**: Automatic error detection and recovery
- **Multi-Strategy Pathfinding**: Multiple approaches to navigation challenges
- **Health Management**: Automatic food consumption and safety seeking

## Performance Notes

- Environment analysis caches results for 5 seconds
- Pathfinding includes timeout protection (30 seconds default)
- Error handling includes exponential backoff for retries
- Memory system uses bounded collections to prevent memory leaks
- Auto mode respects rate limits and resource constraints

## Troubleshooting

### Common Issues

1. **Bot won't connect**: Check MC_HOST, MC_PORT, and MC_VERSION in .env
2. **Intelligence features not working**: Ensure bot is fully spawned and connected
3. **Pathfinding failures**: Try safe-path or alternative-paths endpoints
4. **Auto mode not responding**: Check error logs via `/errors/recent`

### Debug Commands

```bash
# Check system health
curl http://localhost:3003/enhanced/system-check

# View recent errors
curl http://localhost:3003/errors/recent

# Get error statistics
curl http://localhost:3003/errors/stats

# Test error handling
curl -X POST http://localhost:3003/errors/test \
  -H "Content-Type: application/json" \
  -d '{"errorType": "debug", "message": "Debug test"}'
```

## Documentation

- [ENHANCED_API.md](./ENHANCED_API.md) - Complete API reference
- [SUMMARY.md](./SUMMARY.md) - Implementation details and architecture

The enhanced system maintains full backward compatibility with the original mcquest-minimal API while adding powerful AI and automation capabilities.