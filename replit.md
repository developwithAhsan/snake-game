# Slither.io Multiplayer Clone

## Overview
This is a multiplayer clone of the popular game Slither.io, built with JavaScript, Phaser 3, and Socket.IO for real-time multiplayer functionality. The game features a circular map boundary, scoring system, leaderboard, and supports multiple concurrent players on both mobile and desktop devices.

**Current State**: Fully functional online multiplayer snake game with real-time synchronization and performance optimizations for lag-free gameplay.

## Features
- **Online Multiplayer**: Multiple players can join and play simultaneously
- **Real-time Sync**: Socket.IO provides instant game state updates
- **Circular Map**: Bounded circular arena with visual boundary warnings
- **Scoring System**: Track scores and view live leaderboard
- **Minimap**: See all players' positions on a mini radar
- **Mouse/Keyboard Controls**: Move with mouse, boost with spacebar or click
- **Mobile Touch Controls**: Virtual joystick and boost button for mobile devices
- **Death & Respawn**: Automatic respawn after death, food drops on death
- **Player Names**: Custom names displayed above other players
- **Adaptive Quality**: Auto-detects device performance and adjusts graphics

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
1. Node.js server manages authoritative game state at 30 FPS (optimized)
2. Socket.IO broadcasts compressed state to clients at 15 updates/second
3. Clients send input (angle, boost) to server
4. Server handles collisions, eating, death, and respawning
5. Circular boundary kills snakes that exceed the map radius
6. Leaderboard updates in real-time based on scores

### Game Configuration
```javascript
MAP_RADIUS: 2000          // Circular map radius
TICK_RATE: 30             // Server updates per second
NETWORK_RATE: 15          // Network updates per second
FOOD_COUNT: 200           // Total food on map (optimized)
INITIAL_SNAKE_LENGTH: 10  // Starting snake segments
SNAKE_SPEED: 3            // Normal movement speed
BOOST_SPEED: 6            // Speed when boosting
VIEW_DISTANCE: 600        // Visible area radius
```

## Performance Optimizations

### Server-Side
- **Spatial Grid Partitioning**: Food stored in grid cells for O(1) lookup
- **View Distance Culling**: Only send visible entities to each player
- **Segment Compression**: Large snakes have segments compressed for network
- **Optimized Tick Rates**: 30 FPS game logic, 15 FPS network updates
- **Distance-squared Collision**: Avoids expensive sqrt calculations

### Client-Side
- **Color Caching**: Pre-computed color values avoid per-frame conversion
- **Camera Interpolation**: Smooth camera following with lerp
- **Grid Tile Sprite**: Static grid texture instead of per-frame drawing
- **Batch Rendering**: Food grouped by color for fewer draw calls
- **Adaptive Quality Levels**: Auto-detects device and adjusts:
  - High: Full shadows, highlights, 60 FPS
  - Medium: Reduced effects, 60 FPS
  - Low: Minimal effects, skip segments, 30 FPS
- **Screen Culling**: Skip drawing off-screen entities
- **WebSocket Only**: Forced WebSocket transport for lower latency

### Mobile Optimizations
- **Touch Joystick**: Drag anywhere to control direction
- **Boost Button**: Dedicated boost button on right side
- **Smaller Minimap**: Reduced UI for mobile screens
- **No Zoom/Scroll**: Viewport locked to prevent accidental gestures

## Development

### Running Locally
The game runs automatically via the "Start Game Server" workflow. To manually start:
```bash
node server.js
```
Then open http://0.0.0.0:5000 in your browser.

### Controls
**Desktop:**
- **Movement**: Mouse to aim
- **Speed Boost**: Spacebar or mouse click (consumes snake length)

**Mobile:**
- **Movement**: Drag anywhere on screen
- **Speed Boost**: Tap boost button on bottom right

## Deployment
Configured for autoscale deployment running `node server.js`.

## Recent Changes
- **2025-11-27**: Performance optimizations for lag-free gameplay
  - Added spatial grid partitioning for food collision detection
  - Implemented segment compression for large snakes
  - Added adaptive quality settings (high/medium/low)
  - Optimized tick rates (30 FPS game, 15 FPS network)
  - Added camera interpolation for smooth following
  - Implemented color caching to avoid per-frame parsing
  - Added grid tile sprite for background (no per-frame redraw)
  - Batched food rendering by color
  - Added mobile touch controls (virtual joystick + boost button)
  - Fixed viewport for mobile devices
  - Reduced food count and view distance for performance

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
