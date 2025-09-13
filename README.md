# Mineflayer RPG Bot

A Minecraft bot built with Mineflayer that follows and interacts with players. This is the beginning of a larger RPG gameplay automation project that will eventually integrate with MCP (Model Context Protocol).

## Features

- 🤖 Bot automatically connects to local Minecraft server
- 👀 Always looks at and follows the player
- 🎮 Foundation for RPG gameplay automation

## Prerequisites

- Node.js (v14 or higher)
- Minecraft Java Edition
- Local Minecraft server running

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd mineflayer-rpg-bot
```

2. Install dependencies:
```bash
npm install
```

## Usage

1. Start your local Minecraft server
2. Join the server with your Minecraft client
3. Run the bot:
```bash
node bot.js
```

The bot will connect to your local server and start following you around!

## Configuration

Currently configured for:
- Host: `localhost`
- Default Minecraft port (25565)
- Bot username: configurable in the code

## Project Structure

```
├── bot.js          # Main bot logic
├── package.json    # Dependencies and project info
├── .gitignore      # Git ignore rules
└── README.md       # This file
```

## Roadmap

- [ ] Add pathfinding for smarter movement
- [ ] Implement basic combat mechanics
- [ ] Add inventory management
- [ ] Create quest system foundation
- [ ] Integrate with MCP for AI decision making
- [ ] Add web interface for monitoring

## Dependencies

- `mineflayer`: Core Minecraft bot framework
- Additional plugins as needed for RPG features

## Contributing

This is an early-stage project. Feel free to submit issues or pull requests!

## License

MIT License - feel free to use and modify as needed.

---

**Note**: This bot is designed for educational and personal use. Always respect server rules and get permission before running bots on multiplayer servers.