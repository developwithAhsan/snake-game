const MultiplayerGame = (function() {
    let socket;
    let game;
    let myId;
    let gameState = { players: {}, food: [], leaderboard: [] };
    let mapRadius = 2000;
    let camera = { x: 0, y: 0 };
    let inputState = { angle: 0, boosting: false };
    let lastInputState = { angle: 0, boosting: false };
    let lastInputTime = 0;
    let isAlive = true;
    let playerName = '';

    const INPUT_THROTTLE_MS = 50;

    const COLORS = {
        background: '#1a1a2e',
        gridLine: '#2a2a4e',
        boundary: '#ff4444',
        boundaryGlow: 'rgba(255, 68, 68, 0.3)',
        food: '#ff6b6b',
        text: '#ffffff',
        leaderboard: 'rgba(0, 0, 0, 0.7)'
    };

    let uiElements = {
        scoreText: null,
        lengthText: null,
        leaderboardText: null,
        deathText: null,
        nameTexts: {}
    };

    function init() {
        playerName = prompt('Enter your name:', 'Player') || 'Player';

        socket = io();

        socket.on('connect', () => {
            console.log('Connected to server');
            socket.emit('join', { name: playerName });
        });

        socket.on('joined', (data) => {
            myId = data.id;
            mapRadius = data.mapRadius;
            console.log('Joined game as', data.player.name);
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        });

        socket.on('gameState', (state) => {
            gameState = state;
            if (state.mapRadius) mapRadius = state.mapRadius;
        });

        socket.on('died', (data) => {
            isAlive = false;
            console.log('You died! Score:', data.score);
        });

        socket.on('respawned', (player) => {
            isAlive = true;
            console.log('Respawned!');
        });

        game = new Phaser.Game({
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: 'game-container',
            backgroundColor: COLORS.background,
            scene: {
                preload: preload,
                create: create,
                update: update
            }
        });

        window.addEventListener('resize', () => {
            game.scale.resize(window.innerWidth, window.innerHeight);
        });
    }

    function preload() {
        this.load.image('circle', 'asset/circle.png');
        this.load.image('food', 'asset/hex.png');
        this.load.image('eye-white', 'asset/eye-white.png');
        this.load.image('eye-black', 'asset/eye-black.png');
    }

    function create() {
        this.graphics = this.add.graphics();
        this.snakeGraphics = this.add.graphics();
        this.uiGraphics = this.add.graphics();

        uiElements.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontSize: '18px',
            fill: '#ffffff'
        });
        uiElements.scoreText.setDepth(100);

        uiElements.lengthText = this.add.text(20, 45, 'Length: 0', {
            fontSize: '14px',
            fill: '#cccccc'
        });
        uiElements.lengthText.setDepth(100);

        uiElements.leaderboardText = this.add.text(0, 20, 'Leaderboard', {
            fontSize: '14px',
            fill: '#ffffff',
            lineSpacing: 5
        });
        uiElements.leaderboardText.setDepth(100);

        uiElements.deathText = this.add.text(0, 0, 'You Died! Respawning...', {
            fontSize: '32px',
            fill: '#ff4444',
            stroke: '#000000',
            strokeThickness: 4
        });
        uiElements.deathText.setOrigin(0.5);
        uiElements.deathText.setDepth(100);
        uiElements.deathText.setVisible(false);

        this.input.on('pointermove', (pointer) => {
            const centerX = this.cameras.main.width / 2;
            const centerY = this.cameras.main.height / 2;
            inputState.angle = Math.atan2(pointer.y - centerY, pointer.x - centerX);
        });

        this.input.keyboard.on('keydown-SPACE', () => {
            inputState.boosting = true;
        });

        this.input.keyboard.on('keyup-SPACE', () => {
            inputState.boosting = false;
        });

        this.input.on('pointerdown', () => {
            inputState.boosting = true;
        });

        this.input.on('pointerup', () => {
            inputState.boosting = false;
        });
    }

    function sendInput() {
        const now = Date.now();
        const angleDiff = Math.abs(inputState.angle - lastInputState.angle);
        const boostChanged = inputState.boosting !== lastInputState.boosting;

        if (now - lastInputTime > INPUT_THROTTLE_MS || angleDiff > 0.1 || boostChanged) {
            socket.emit('input', inputState);
            lastInputState.angle = inputState.angle;
            lastInputState.boosting = inputState.boosting;
            lastInputTime = now;
        }
    }

    function update() {
        if (!myId) return;

        sendInput();

        const myPlayer = gameState.players[myId];
        if (myPlayer && myPlayer.segments && myPlayer.segments.length > 0) {
            const head = myPlayer.segments[0];
            camera.x = head.x;
            camera.y = head.y;
        }

        this.graphics.clear();
        this.snakeGraphics.clear();
        this.uiGraphics.clear();

        drawBackground.call(this);
        drawBoundary.call(this);
        drawFood.call(this);
        drawSnakes.call(this);
        drawUI.call(this);
    }

    function drawBackground() {
        const graphics = this.graphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const gridSize = 50;

        graphics.lineStyle(1, 0x2a2a4e, 0.5);

        const startX = -camera.x % gridSize - gridSize;
        const startY = -camera.y % gridSize - gridSize;

        for (let x = startX; x < this.cameras.main.width + gridSize; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, this.cameras.main.height);
        }

        for (let y = startY; y < this.cameras.main.height + gridSize; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(this.cameras.main.width, y);
        }

        graphics.strokePath();
    }

    function drawBoundary() {
        const graphics = this.graphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        const boundaryScreenX = centerX - camera.x;
        const boundaryScreenY = centerY - camera.y;

        graphics.lineStyle(8, 0xff4444, 0.8);
        graphics.strokeCircle(boundaryScreenX, boundaryScreenY, mapRadius);

        graphics.lineStyle(20, 0xff4444, 0.2);
        graphics.strokeCircle(boundaryScreenX, boundaryScreenY, mapRadius);

        const myPlayer = gameState.players[myId];
        if (myPlayer && myPlayer.segments && myPlayer.segments.length > 0) {
            const head = myPlayer.segments[0];
            const distFromCenter = Math.sqrt(head.x * head.x + head.y * head.y);
            const distFromBoundary = mapRadius - distFromCenter;

            if (distFromBoundary < 200) {
                const warningAlpha = (200 - distFromBoundary) / 200 * 0.5;
                graphics.lineStyle(40, 0xff0000, warningAlpha);
                graphics.strokeCircle(boundaryScreenX, boundaryScreenY, mapRadius);
            }
        }
    }

    function drawFood() {
        const graphics = this.graphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        for (const food of gameState.food) {
            const screenX = centerX + (food.x - camera.x);
            const screenY = centerY + (food.y - camera.y);

            if (screenX < -20 || screenX > this.cameras.main.width + 20 ||
                screenY < -20 || screenY > this.cameras.main.height + 20) {
                continue;
            }

            const color = Phaser.Display.Color.HexStringToColor(food.color).color;
            graphics.fillStyle(color, 1);
            graphics.fillCircle(screenX, screenY, 8);

            graphics.fillStyle(0xffffff, 0.3);
            graphics.fillCircle(screenX - 2, screenY - 2, 3);
        }
    }

    function drawSnakes() {
        const graphics = this.snakeGraphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        const sortedPlayers = Object.values(gameState.players).sort((a, b) => {
            if (a.id === myId) return 1;
            if (b.id === myId) return -1;
            return 0;
        });

        const activePlayerIds = new Set();

        for (const player of sortedPlayers) {
            if (!player.alive || !player.segments || player.segments.length === 0) continue;

            activePlayerIds.add(player.id);

            const color = Phaser.Display.Color.HexStringToColor(player.color).color;
            const isMe = player.id === myId;

            graphics.fillStyle(0x000000, 0.3);
            for (let i = player.segments.length - 1; i >= 0; i--) {
                const seg = player.segments[i];
                const screenX = centerX + (seg.x - camera.x) + 5;
                const screenY = centerY + (seg.y - camera.y) + 5;

                if (screenX < -30 || screenX > this.cameras.main.width + 30 ||
                    screenY < -30 || screenY > this.cameras.main.height + 30) {
                    continue;
                }

                const size = 12 - (i / player.segments.length) * 4;
                graphics.fillCircle(screenX, screenY, size);
            }

            for (let i = player.segments.length - 1; i >= 0; i--) {
                const seg = player.segments[i];
                const screenX = centerX + (seg.x - camera.x);
                const screenY = centerY + (seg.y - camera.y);

                if (screenX < -30 || screenX > this.cameras.main.width + 30 ||
                    screenY < -30 || screenY > this.cameras.main.height + 30) {
                    continue;
                }

                const size = 12 - (i / player.segments.length) * 4;
                graphics.fillStyle(color, 1);
                graphics.fillCircle(screenX, screenY, size);

                if (isMe) {
                    graphics.lineStyle(2, 0xffffff, 0.3);
                    graphics.strokeCircle(screenX, screenY, size);
                }
            }

            const head = player.segments[0];
            const headX = centerX + (head.x - camera.x);
            const headY = centerY + (head.y - camera.y);

            if (headX >= -30 && headX <= this.cameras.main.width + 30 &&
                headY >= -30 && headY <= this.cameras.main.height + 30) {

                let angle = 0;
                if (player.segments.length > 1) {
                    const next = player.segments[1];
                    angle = Math.atan2(head.y - next.y, head.x - next.x);
                }

                const eyeOffset = 6;
                const eyeAngle1 = angle + Math.PI / 4;
                const eyeAngle2 = angle - Math.PI / 4;

                const eye1X = headX + Math.cos(eyeAngle1) * eyeOffset;
                const eye1Y = headY + Math.sin(eyeAngle1) * eyeOffset;
                const eye2X = headX + Math.cos(eyeAngle2) * eyeOffset;
                const eye2Y = headY + Math.sin(eyeAngle2) * eyeOffset;

                graphics.fillStyle(0xffffff, 1);
                graphics.fillCircle(eye1X, eye1Y, 5);
                graphics.fillCircle(eye2X, eye2Y, 5);

                const pupilOffset = 2;
                graphics.fillStyle(0x000000, 1);
                graphics.fillCircle(eye1X + Math.cos(angle) * pupilOffset, eye1Y + Math.sin(angle) * pupilOffset, 2.5);
                graphics.fillCircle(eye2X + Math.cos(angle) * pupilOffset, eye2Y + Math.sin(angle) * pupilOffset, 2.5);

                if (!isMe) {
                    if (!uiElements.nameTexts[player.id]) {
                        uiElements.nameTexts[player.id] = this.add.text(0, 0, player.name, {
                            fontSize: '14px',
                            fill: '#ffffff',
                            stroke: '#000000',
                            strokeThickness: 2
                        });
                        uiElements.nameTexts[player.id].setOrigin(0.5);
                        uiElements.nameTexts[player.id].setDepth(50);
                    }
                    uiElements.nameTexts[player.id].setPosition(headX, headY - 25);
                    uiElements.nameTexts[player.id].setVisible(true);
                }
            }
        }

        for (const playerId in uiElements.nameTexts) {
            if (!activePlayerIds.has(playerId)) {
                uiElements.nameTexts[playerId].setVisible(false);
            }
        }
    }

    function drawUI() {
        const graphics = this.uiGraphics;
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        graphics.fillStyle(0x000000, 0.7);
        graphics.fillRoundedRect(width - 220, 10, 210, 30 + gameState.leaderboard.length * 25, 8);

        let leaderboardText = 'Leaderboard\n';
        gameState.leaderboard.forEach((entry, i) => {
            leaderboardText += `${i + 1}. ${entry.name}: ${entry.score}\n`;
        });

        uiElements.leaderboardText.setText(leaderboardText);
        uiElements.leaderboardText.setPosition(width - 210, 20);

        const myPlayer = gameState.players[myId];
        if (myPlayer) {
            graphics.fillStyle(0x000000, 0.7);
            graphics.fillRoundedRect(10, 10, 200, 60, 8);

            uiElements.scoreText.setText(`Score: ${myPlayer.score}`);
            uiElements.lengthText.setText(`Length: ${myPlayer.segments ? myPlayer.segments.length : 0}`);
        }

        const minimapSize = 150;
        const minimapX = 10;
        const minimapY = height - minimapSize - 10;

        graphics.fillStyle(0x000000, 0.5);
        graphics.fillCircle(minimapX + minimapSize / 2, minimapY + minimapSize / 2, minimapSize / 2);

        graphics.lineStyle(2, 0xff4444, 0.8);
        graphics.strokeCircle(minimapX + minimapSize / 2, minimapY + minimapSize / 2, minimapSize / 2);

        const scale = minimapSize / (mapRadius * 2);

        for (const id in gameState.players) {
            const player = gameState.players[id];
            if (!player.alive || !player.segments || player.segments.length === 0) continue;

            const head = player.segments[0];
            const dotX = minimapX + minimapSize / 2 + head.x * scale;
            const dotY = minimapY + minimapSize / 2 + head.y * scale;

            if (player.id === myId) {
                graphics.fillStyle(0x00ff00, 1);
                graphics.fillCircle(dotX, dotY, 4);
            } else {
                const color = Phaser.Display.Color.HexStringToColor(player.color).color;
                graphics.fillStyle(color, 1);
                graphics.fillCircle(dotX, dotY, 3);
            }
        }

        uiElements.deathText.setPosition(width / 2, height / 2);
        uiElements.deathText.setVisible(!isAlive);

        if (!isAlive) {
            graphics.fillStyle(0x000000, 0.8);
            graphics.fillRect(0, height / 2 - 50, width, 100);
        }
    }

    return { init };
})();

window.onload = () => {
    MultiplayerGame.init();
};
