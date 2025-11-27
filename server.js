const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    perMessageDeflate: {
        threshold: 1024
    }
});

app.use(express.static('.'));

const GAME_CONFIG = {
    MAP_RADIUS: 2000,
    TICK_RATE: 30,
    NETWORK_RATE: 15,
    FOOD_COUNT: 200,
    INITIAL_SNAKE_LENGTH: 10,
    SNAKE_SPEED: 3,
    BOOST_SPEED: 6,
    SEGMENT_DISTANCE: 15,
    FOOD_VALUE: 1,
    VIEW_DISTANCE: 600,
    GRID_SIZE: 200,
    SNAKE_COLORS: [
        '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#f39c12',
        '#1abc9c', '#e91e63', '#00bcd4', '#ff5722', '#795548'
    ]
};

let networkTick = 0;

const gameState = {
    players: {},
    food: [],
    foodGrid: {},
    leaderboard: [],
    lastState: {}
};

function getGridKey(x, y) {
    const gx = Math.floor(x / GAME_CONFIG.GRID_SIZE);
    const gy = Math.floor(y / GAME_CONFIG.GRID_SIZE);
    return `${gx},${gy}`;
}

function addFoodToGrid(food) {
    const key = getGridKey(food.x, food.y);
    if (!gameState.foodGrid[key]) {
        gameState.foodGrid[key] = [];
    }
    gameState.foodGrid[key].push(food);
}

function removeFoodFromGrid(food) {
    const key = getGridKey(food.x, food.y);
    if (gameState.foodGrid[key]) {
        const idx = gameState.foodGrid[key].indexOf(food);
        if (idx !== -1) {
            gameState.foodGrid[key].splice(idx, 1);
        }
    }
}

function generateFood() {
    const food = [];
    gameState.foodGrid = {};
    for (let i = 0; i < GAME_CONFIG.FOOD_COUNT; i++) {
        const f = createFood(i);
        food.push(f);
        addFoodToGrid(f);
    }
    return food;
}

function createFood(id) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (GAME_CONFIG.MAP_RADIUS - 100);
    const food = {
        id: id,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        color: GAME_CONFIG.SNAKE_COLORS[Math.floor(Math.random() * GAME_CONFIG.SNAKE_COLORS.length)]
    };
    return food;
}

function createPlayer(id, name) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * (GAME_CONFIG.MAP_RADIUS / 2);
    const startX = Math.cos(angle) * radius;
    const startY = Math.sin(angle) * radius;
    const color = GAME_CONFIG.SNAKE_COLORS[Math.floor(Math.random() * GAME_CONFIG.SNAKE_COLORS.length)];

    const segments = [];
    for (let i = 0; i < GAME_CONFIG.INITIAL_SNAKE_LENGTH; i++) {
        segments.push({
            x: startX,
            y: startY + i * GAME_CONFIG.SEGMENT_DISTANCE
        });
    }

    return {
        id: id,
        name: name || `Player ${id.substring(0, 4)}`,
        color: color,
        segments: segments,
        angle: -Math.PI / 2,
        targetAngle: -Math.PI / 2,
        speed: GAME_CONFIG.SNAKE_SPEED,
        boosting: false,
        score: 0,
        alive: true,
        lastUpdate: Date.now()
    };
}

function updatePlayer(player) {
    if (!player.alive) return;

    const angleDiff = player.targetAngle - player.angle;
    let normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
    player.angle += normalizedDiff * 0.1;

    const speed = player.boosting ? GAME_CONFIG.BOOST_SPEED : GAME_CONFIG.SNAKE_SPEED;

    if (player.boosting && player.segments.length > GAME_CONFIG.INITIAL_SNAKE_LENGTH) {
        if (Math.random() < 0.1) {
            const tail = player.segments[player.segments.length - 1];
            dropFood(tail.x, tail.y);
            player.segments.pop();
            player.score = Math.max(0, player.score - 1);
        }
    }

    const head = player.segments[0];
    const newHead = {
        x: head.x + Math.cos(player.angle) * speed,
        y: head.y + Math.sin(player.angle) * speed
    };

    const distFromCenter = Math.sqrt(newHead.x * newHead.x + newHead.y * newHead.y);
    if (distFromCenter > GAME_CONFIG.MAP_RADIUS) {
        killPlayer(player);
        return;
    }

    player.segments.unshift(newHead);
    player.segments.pop();
}

function dropFood(x, y) {
    const foodId = Date.now() + Math.random();
    const food = {
        id: foodId,
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        color: GAME_CONFIG.SNAKE_COLORS[Math.floor(Math.random() * GAME_CONFIG.SNAKE_COLORS.length)]
    };
    gameState.food.push(food);
    addFoodToGrid(food);
}

function killPlayer(player) {
    player.alive = false;

    for (let i = 0; i < player.segments.length; i += 2) {
        const seg = player.segments[i];
        dropFood(seg.x, seg.y);
    }

    io.to(player.id).emit('died', { score: player.score, killer: null });

    setTimeout(() => {
        if (gameState.players[player.id]) {
            const newPlayer = createPlayer(player.id, player.name);
            gameState.players[player.id] = newPlayer;
            io.to(player.id).emit('respawned', newPlayer);
        }
    }, 3000);
}

function getNearbyGridCells(x, y, radius) {
    const cells = [];
    const gridRadius = Math.ceil(radius / GAME_CONFIG.GRID_SIZE);
    const centerGx = Math.floor(x / GAME_CONFIG.GRID_SIZE);
    const centerGy = Math.floor(y / GAME_CONFIG.GRID_SIZE);
    
    for (let dx = -gridRadius; dx <= gridRadius; dx++) {
        for (let dy = -gridRadius; dy <= gridRadius; dy++) {
            const key = `${centerGx + dx},${centerGy + dy}`;
            if (gameState.foodGrid[key]) {
                cells.push(...gameState.foodGrid[key]);
            }
        }
    }
    return cells;
}

function checkCollisions(player) {
    if (!player.alive) return;

    const head = player.segments[0];
    const nearbyFood = getNearbyGridCells(head.x, head.y, 50);

    for (let i = nearbyFood.length - 1; i >= 0; i--) {
        const food = nearbyFood[i];
        const dx = head.x - food.x;
        const dy = head.y - food.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < 400) {
            removeFoodFromGrid(food);
            const idx = gameState.food.indexOf(food);
            if (idx !== -1) {
                gameState.food.splice(idx, 1);
            }
            player.score += GAME_CONFIG.FOOD_VALUE;

            const tail = player.segments[player.segments.length - 1];
            player.segments.push({ x: tail.x, y: tail.y });

            const newFood = createFood(Date.now() + i);
            gameState.food.push(newFood);
            addFoodToGrid(newFood);
        }
    }

    for (const otherId in gameState.players) {
        if (otherId === player.id) continue;
        const other = gameState.players[otherId];
        if (!other.alive) continue;

        const otherHead = other.segments[0];
        const hdx = head.x - otherHead.x;
        const hdy = head.y - otherHead.y;
        if (hdx * hdx + hdy * hdy > 640000) continue;

        for (let i = 0; i < other.segments.length; i++) {
            const seg = other.segments[i];
            const dx = head.x - seg.x;
            const dy = head.y - seg.y;
            const distSq = dx * dx + dy * dy;

            if (distSq < 225) {
                killPlayer(player);
                other.score += Math.floor(player.score / 2);
                return;
            }
        }
    }

    for (let i = 10; i < player.segments.length; i++) {
        const seg = player.segments[i];
        const dx = head.x - seg.x;
        const dy = head.y - seg.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < 100) {
            killPlayer(player);
            return;
        }
    }
}

function updateLeaderboard() {
    const scores = [];
    for (const id in gameState.players) {
        const player = gameState.players[id];
        if (player.alive) {
            scores.push({
                name: player.name,
                score: player.score,
                length: player.segments.length
            });
        }
    }
    scores.sort((a, b) => b.score - a.score);
    gameState.leaderboard = scores.slice(0, 10);
}

function getNearbyFood(playerX, playerY) {
    const viewDist = GAME_CONFIG.VIEW_DISTANCE;
    const viewDistSq = viewDist * viewDist;
    const nearbyGridFood = getNearbyGridCells(playerX, playerY, viewDist);
    
    return nearbyGridFood.filter(food => {
        const dx = food.x - playerX;
        const dy = food.y - playerY;
        return dx * dx + dy * dy < viewDistSq;
    });
}

function compressSegments(segments, maxPoints) {
    if (segments.length <= maxPoints) {
        return segments.map(seg => ({ x: seg.x, y: seg.y }));
    }
    
    const step = segments.length / maxPoints;
    const compressed = [];
    for (let i = 0; i < maxPoints; i++) {
        const idx = Math.min(Math.floor(i * step), segments.length - 1);
        const seg = segments[idx];
        compressed.push({ x: seg.x, y: seg.y });
    }
    const lastSeg = segments[segments.length - 1];
    const lastCompressed = compressed[compressed.length - 1];
    if (lastCompressed.x !== lastSeg.x || lastCompressed.y !== lastSeg.y) {
        compressed.push({ x: lastSeg.x, y: lastSeg.y });
    }
    return compressed;
}

function gameLoop() {
    for (const id in gameState.players) {
        const player = gameState.players[id];
        updatePlayer(player);
        checkCollisions(player);
    }

    updateLeaderboard();

    networkTick++;
    if (networkTick < GAME_CONFIG.TICK_RATE / GAME_CONFIG.NETWORK_RATE) {
        return;
    }
    networkTick = 0;

    const now = Date.now();

    for (const socketId in gameState.players) {
        const myPlayer = gameState.players[socketId];
        if (!myPlayer.segments || myPlayer.segments.length === 0) continue;

        const head = myPlayer.segments[0];
        const nearbyFood = getNearbyFood(head.x, head.y);

        const players = {};
        const viewDistSq = GAME_CONFIG.VIEW_DISTANCE * GAME_CONFIG.VIEW_DISTANCE * 4;

        for (const id in gameState.players) {
            const p = gameState.players[id];
            if (!p.alive || !p.segments || p.segments.length === 0) continue;

            const pHead = p.segments[0];
            const dx = pHead.x - head.x;
            const dy = pHead.y - head.y;
            const distSq = dx * dx + dy * dy;

            if (id === socketId || distSq < viewDistSq) {
                const maxSegments = id === socketId ? 100 : 50;
                players[id] = {
                    id: p.id,
                    name: p.name,
                    color: p.color,
                    segments: compressSegments(p.segments, maxSegments),
                    score: p.score,
                    alive: p.alive,
                    angle: p.angle
                };
            }
        }

        const state = {
            players: players,
            food: nearbyFood,
            leaderboard: gameState.leaderboard,
            mapRadius: GAME_CONFIG.MAP_RADIUS,
            serverTime: now
        };

        io.to(socketId).emit('gameState', state);
    }
}

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    socket.on('join', (data) => {
        const player = createPlayer(socket.id, data.name);
        gameState.players[socket.id] = player;

        socket.emit('joined', {
            id: socket.id,
            player: player,
            mapRadius: GAME_CONFIG.MAP_RADIUS,
            tickRate: GAME_CONFIG.TICK_RATE,
            networkRate: GAME_CONFIG.NETWORK_RATE
        });

        console.log(`${player.name} joined the game`);
    });

    socket.on('input', (data) => {
        const player = gameState.players[socket.id];
        if (player && player.alive) {
            if (data.angle !== undefined) {
                player.targetAngle = data.angle;
            }
            if (data.boosting !== undefined) {
                player.boosting = data.boosting;
            }
            player.lastUpdate = Date.now();
        }
    });

    socket.on('disconnect', () => {
        const player = gameState.players[socket.id];
        if (player) {
            console.log(`${player.name} left the game`);
            for (let i = 0; i < player.segments.length; i += 3) {
                const seg = player.segments[i];
                dropFood(seg.x, seg.y);
            }
        }
        delete gameState.players[socket.id];
        delete gameState.lastState[socket.id];
    });
});

gameState.food = generateFood();

setInterval(gameLoop, 1000 / GAME_CONFIG.TICK_RATE);

const PORT = 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Multiplayer Slither.io server running on http://0.0.0.0:${PORT}`);
});
