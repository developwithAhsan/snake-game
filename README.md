# Slither.io Multiplayer Clone

A real-time online multiplayer snake game inspired by Slither.io, built with Node.js, Socket.IO, and Phaser 3.

## Play Now

Join the arena, eat food pellets to grow, and avoid crashing into other snakes!

## Features

- **Online Multiplayer** - Play with friends and strangers in real-time
- **Circular Arena** - Navigate within a bounded circular map
- **Leaderboard** - Compete for the top spot on the live leaderboard
- **Speed Boost** - Use boost to outmaneuver opponents (costs length)
- **Minimap** - Track all players on the radar
- **Auto-Respawn** - Get back in the game 3 seconds after death

## Controls

| Action | Control |
|--------|---------|
| Move | Mouse cursor |
| Boost | Spacebar or Mouse Click |

## How to Play

1. Enter your name when prompted
2. Move your snake by pointing your mouse where you want to go
3. Eat colored food pellets to grow longer and increase your score
4. Avoid hitting other snakes or the red boundary
5. Use boost strategically to escape danger or cut off opponents
6. When you die, your snake becomes food for others

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **Frontend**: Phaser 3 (HTML5 Canvas/WebGL)
- **Real-time**: WebSocket communication at 20Hz

## Running Locally

```bash
npm install
node server.js
```

Then open http://localhost:5000 in your browser.

## Game Configuration

| Setting | Value |
|---------|-------|
| Map Radius | 2000 pixels |
| Starting Length | 10 segments |
| Normal Speed | 3 |
| Boost Speed | 6 |
| Food Count | 300 |

## Project Structure

```
.
├── server.js           # Multiplayer game server
├── index.html          # Main HTML file
├── client/
│   └── game.js         # Phaser 3 game client
├── asset/              # Game graphics
│   ├── circle.png
│   ├── hex.png
│   ├── eye-white.png
│   ├── eye-black.png
│   └── ...
└── package.json        # Dependencies
```

## Credits

Original single-player concept based on the tutorial series from [Loonride](https://loonride.com/learn/phaser/slither-io-part-1).

## License

MIT License
