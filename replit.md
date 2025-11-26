# Slither.io Multiplayer Clone

## Overview
This is a multiplayer clone of the popular game Slither.io, built with JavaScript, Phaser 3, and Socket.IO for real-time multiplayer functionality. The game features a circular map boundary, scoring system, leaderboard, and supports multiple concurrent players.

**Current State**: Fully functional online multiplayer snake game with real-time synchronization.

## Features
- **Online Multiplayer**: Multiple players can join and play simultaneously
- **Real-time Sync**: Socket.IO provides instant game state updates
- **Circular Map**: Bounded circular arena with visual boundary warnings
- **Scoring System**: Track scores and view live leaderboard
- **Minimap**: See all players' positions on a mini radar
- **Mouse/Keyboard Controls**: Move with mouse, boost with spacebar or click
- **Death & Respawn**: Automatic respawn after death, food drops on death
- **Player Names**: Custom names displayed above other players

## Project Architecture

### Directory Structure
```
.
├── index.html          # Main HTML file with game container
├── server.js           # Node.js/Express/Socket.IO multiplayer server
├── package.json        # Node.js dependencies
├── client/
│   └── game.js         # Phaser 3 multiplayer client
├── src/                # Legacy single-player game files (preserved)
│   ├── game.js         # Original game state
│   ├── snake.js        # Base snake class
│   └── ...             # Other original files
└── asset/
    ├── circle.png      # Snake body segments
    ├── tile.png        # Background tile
    ├── white-shadow.png # Shadow effect
    ├── eye-white.png   # Eye white part
    ├── eye-black.png   # Eye pupil
    └── hex.png         # Food pellet sprite
```

### Technology Stack
- **Frontend**: HTML5, JavaScript, Phaser 3.60.0
- **Backend**: Node.js 20, Express.js
- **Real-time**: Socket.IO 4.7.2
- **Rendering**: Phaser (Canvas/WebGL)

### How It Works
1. Node.js server manages authoritative game state at 60 FPS
2. Socket.IO broadcasts state to all connected clients
3. Clients send input (angle, boost) to server
4. Server handles collisions, eating, death, and respawning
5. Circular boundary kills snakes that exceed the map radius
6. Leaderboard updates in real-time based on scores

### Game Configuration
```javascript
MAP_RADIUS: 2000          // Circular map radius
TICK_RATE: 60             // Server updates per second
FOOD_COUNT: 500           // Total food on map
INITIAL_SNAKE_LENGTH: 10  // Starting snake segments
SNAKE_SPEED: 3            // Normal movement speed
BOOST_SPEED: 6            // Speed when boosting
```

## Development

### Running Locally
The game runs automatically via the "Start Game Server" workflow. To manually start:
```bash
node server.js
```
Then open http://0.0.0.0:5000 in your browser.

### Controls
- **Movement**: Mouse to aim
- **Speed Boost**: Spacebar or mouse click (consumes snake length)

## Deployment
Configured for autoscale deployment running `node server.js`.

## Recent Changes
- **2025-11-26**: Converted to online multiplayer using Socket.IO
  - Added Node.js/Express server with real-time game state
  - Implemented circular map boundary with death on crossing
  - Added scoring system and live leaderboard
  - Created Phaser 3 multiplayer client
  - Added minimap showing all player positions
  - Implemented player names and respawn system

## User Preferences
- None specified yet

## Attribution
Original single-player concept based on the tutorial series from [Loonride](https://loonride.com/learn/phaser/slither-io-part-1).
