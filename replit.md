# Slither.io Clone

## Overview
This is a clone of the popular game Slither.io, built with JavaScript and the Phaser 2.6.2 game framework. The game demonstrates physics collisions and game organization concepts without implementing the multiplayer server aspect.

**Current State**: Fully functional single-player snake game with bot opponents, running on a Python web server.

## Features
- Player and bot snakes
- Mouse and arrow-key controls
- Speed boost with spacebar
- Death from head-on collisions
- Random food placed at start
- Snake growth from eating food
- Food dropped on death
- Shadows and interactive eyes

## Project Architecture

### Directory Structure
```
.
├── index.html          # Main HTML file that loads the game
├── server.py           # Python HTTP server with cache control (runs on port 5000)
├── lib/
│   └── phaser.min.js   # Phaser 2.6.2 game framework
├── src/
│   ├── game.js         # Main game state and initialization
│   ├── snake.js        # Base snake class
│   ├── playerSnake.js  # Player-controlled snake
│   ├── botSnake.js     # AI-controlled bot snakes
│   ├── eye.js          # Snake eye component
│   ├── eyePair.js      # Manages both eyes
│   ├── shadow.js       # Snake shadow effects
│   ├── food.js         # Food pellets
│   └── util.js         # Utility functions
└── asset/
    ├── circle.png      # Snake body segments
    ├── tile.png        # Background tile
    ├── white-shadow.png # Shadow effect
    ├── eye-white.png   # Eye white part
    ├── eye-black.png   # Eye pupil
    └── hex.png         # Food pellet sprite
```

### Technology Stack
- **Frontend**: HTML5, JavaScript, Phaser 2.6.2
- **Server**: Python 3.11 with built-in HTTP server
- **Game Engine**: Phaser (Canvas rendering)

### How It Works
1. The Python server serves static files on port 5000 with cache-control headers disabled
2. Phaser game initializes with 800x600 canvas
3. Player controls the main snake with mouse/arrow keys
4. Bot snakes move autonomously using AI logic
5. Collisions are detected using Phaser's physics system
6. Food spawns randomly and snakes grow when eating

## Development

### Running Locally
The game runs automatically via the "Start Game Server" workflow. To manually start:
```bash
python3 server.py
```
Then open http://0.0.0.0:5000 in your browser.

### Controls
- **Movement**: Arrow keys or mouse
- **Speed Boost**: Spacebar (consumes length)

## Deployment
Configured for static deployment with the root directory as the public directory.

## Recent Changes
- **2025-11-26**: Initial setup - Downloaded game files from loonride.com tutorial, set up Python server, configured all assets and dependencies

## Attribution
This game is based on the tutorial series from [Loonride](https://loonride.com/learn/phaser/slither-io-part-1).
Original demo: https://loonride.com/examples/slither-io/slither-io/
