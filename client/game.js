const MultiplayerGame = (function() {
    let socket;
    let game;
    let myId;
    let gameState = { players: {}, food: [], leaderboard: [] };
    let prevGameState = { players: {}, food: [] };
    let mapRadius = 2000;
    let camera = { x: 0, y: 0 };
    let targetCamera = { x: 0, y: 0 };
    let inputState = { angle: 0, boosting: false };
    let lastInputState = { angle: 0, boosting: false };
    let lastInputTime = 0;
    let isAlive = true;
    let playerName = '';
    let lastServerTime = 0;
    let interpolationFactor = 0;
    let lastNetworkUpdate = 0;
    let networkInterval = 33;
    let isMobile = false;
    let qualityLevel = 'high';
    let touchJoystick = { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 };

    let gameConfig = {
        SNAKE_SPEED: 6,
        BOOST_SPEED: 12,
        TURN_SPEED: 0.15,
        SEGMENT_DISTANCE: 12,
        TICK_RATE: 60
    };

    let predictedPlayer = null;
    let lastPredictionTime = 0;

    const INPUT_THROTTLE_MS = 33;
    const CAMERA_LERP = 0.12;
    const PREDICTION_BLEND = 0.2;

    const COLORS = {
        background: 0x1a1a2e,
        gridLine: 0x2a2a4e,
        boundary: 0xff4444,
        text: '#ffffff'
    };

    const colorCache = new Map();

    let uiElements = {
        scoreText: null,
        lengthText: null,
        leaderboardText: null,
        deathText: null,
        nameTexts: {},
        joystickGraphics: null
    };

    let gridTexture = null;
    let gridSprite = null;

    function detectDevice() {
        isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || ('ontouchstart' in window) 
            || (navigator.maxTouchPoints > 0);
        
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        let performance = 'high';
        
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                if (renderer.toLowerCase().includes('mali') || 
                    renderer.toLowerCase().includes('adreno 3') ||
                    renderer.toLowerCase().includes('intel')) {
                    performance = 'medium';
                }
            }
        }
        
        if (isMobile) {
            performance = 'medium';
        }
        
        const memory = navigator.deviceMemory || 4;
        if (memory < 4) {
            performance = 'low';
        }
        
        qualityLevel = performance;
        console.log(`Device: ${isMobile ? 'Mobile' : 'Desktop'}, Quality: ${qualityLevel}`);
    }

    function getColor(hexString) {
        if (!colorCache.has(hexString)) {
            colorCache.set(hexString, Phaser.Display.Color.HexStringToColor(hexString).color);
        }
        return colorCache.get(hexString);
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function lerpAngle(a, b, t) {
        let diff = b - a;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        return a + diff * t;
    }

    function interpolateSegments(prevSegs, currSegs, t) {
        if (!prevSegs || !currSegs) return currSegs || [];
        const result = [];
        const len = Math.min(prevSegs.length, currSegs.length);
        for (let i = 0; i < len; i++) {
            result.push({
                x: lerp(prevSegs[i].x, currSegs[i].x, t),
                y: lerp(prevSegs[i].y, currSegs[i].y, t)
            });
        }
        for (let i = len; i < currSegs.length; i++) {
            result.push({ x: currSegs[i].x, y: currSegs[i].y });
        }
        return result;
    }

    function getInterpolatedPlayer(playerId) {
        const curr = gameState.players[playerId];
        if (!curr || !curr.segments) return curr;
        
        const prev = prevGameState.players && prevGameState.players[playerId];
        if (!prev || !prev.segments) return curr;
        
        const t = Math.min(interpolationFactor, 1);
        return {
            ...curr,
            segments: interpolateSegments(prev.segments, curr.segments, t),
            angle: lerpAngle(prev.angle || 0, curr.angle || 0, t)
        };
    }

    function updatePredictedPlayer(delta) {
        if (!myId || !gameState.players[myId]) return;
        
        const serverPlayer = gameState.players[myId];
        if (!serverPlayer.alive || !serverPlayer.segments || serverPlayer.segments.length === 0) {
            predictedPlayer = null;
            return;
        }

        if (!predictedPlayer) {
            predictedPlayer = {
                segments: serverPlayer.segments.map(s => ({ x: s.x, y: s.y })),
                angle: serverPlayer.angle || inputState.angle,
                score: serverPlayer.score
            };
            return;
        }

        while (predictedPlayer.segments.length < serverPlayer.segments.length) {
            const last = predictedPlayer.segments[predictedPlayer.segments.length - 1];
            predictedPlayer.segments.push({ x: last.x, y: last.y });
        }
        while (predictedPlayer.segments.length > serverPlayer.segments.length) {
            predictedPlayer.segments.pop();
        }

        const angleDiff = inputState.angle - predictedPlayer.angle;
        let normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        predictedPlayer.angle += normalizedDiff * gameConfig.TURN_SPEED;

        const speed = inputState.boosting ? gameConfig.BOOST_SPEED : gameConfig.SNAKE_SPEED;

        const head = predictedPlayer.segments[0];
        const newHead = {
            x: head.x + Math.cos(predictedPlayer.angle) * speed,
            y: head.y + Math.sin(predictedPlayer.angle) * speed
        };

        predictedPlayer.segments.unshift(newHead);
        predictedPlayer.segments.pop();

        const serverHead = serverPlayer.segments[0];
        const blendFactor = PREDICTION_BLEND;
        
        for (let i = 0; i < predictedPlayer.segments.length && i < serverPlayer.segments.length; i++) {
            const factor = i === 0 ? blendFactor : blendFactor * 0.3;
            predictedPlayer.segments[i].x = lerp(predictedPlayer.segments[i].x, serverPlayer.segments[i].x, factor);
            predictedPlayer.segments[i].y = lerp(predictedPlayer.segments[i].y, serverPlayer.segments[i].y, factor);
        }
    }

    function init() {
        detectDevice();
        
        playerName = prompt('Enter your name:', 'Player') || 'Player';

        socket = io({
            transports: ['websocket'],
            upgrade: false
        });

        socket.on('connect', () => {
            console.log('Connected to server');
            socket.emit('join', { name: playerName });
        });

        socket.on('joined', (data) => {
            myId = data.id;
            mapRadius = data.mapRadius;
            if (data.networkRate) {
                networkInterval = 1000 / data.networkRate;
            }
            if (data.config) {
                gameConfig = { ...gameConfig, ...data.config };
            }
            console.log('Joined game as', data.player.name);
            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';
        });

        socket.on('gameState', (state) => {
            prevGameState = JSON.parse(JSON.stringify(gameState));
            gameState = state;
            if (state.mapRadius) mapRadius = state.mapRadius;
            if (state.serverTime) lastServerTime = state.serverTime;
            lastNetworkUpdate = performance.now();
            interpolationFactor = 0;
        });

        socket.on('died', (data) => {
            isAlive = false;
            predictedPlayer = null;
            console.log('You died! Score:', data.score);
        });

        socket.on('respawned', (player) => {
            isAlive = true;
            predictedPlayer = null;
            console.log('Respawned!');
        });

        const gameConfigPhaser = {
            type: Phaser.AUTO,
            width: window.innerWidth,
            height: window.innerHeight,
            parent: 'game-container',
            backgroundColor: COLORS.background,
            render: {
                antialias: qualityLevel === 'high',
                pixelArt: false,
                roundPixels: true,
                powerPreference: 'high-performance'
            },
            fps: {
                target: 60,
                forceSetTimeOut: false
            },
            scene: {
                preload: preload,
                create: create,
                update: update
            }
        };

        game = new Phaser.Game(gameConfigPhaser);

        window.addEventListener('resize', () => {
            game.scale.resize(window.innerWidth, window.innerHeight);
            if (gridSprite) {
                gridSprite.setPosition(0, 0);
                gridSprite.setDisplaySize(window.innerWidth + 100, window.innerHeight + 100);
            }
        });
    }

    function preload() {
        this.load.image('circle', 'asset/circle.png');
        this.load.image('food', 'asset/hex.png');
        this.load.image('eye-white', 'asset/eye-white.png');
        this.load.image('eye-black', 'asset/eye-black.png');
    }

    function createGridTexture(scene) {
        const gridSize = 50;
        const graphics = scene.add.graphics();
        
        graphics.lineStyle(1, COLORS.gridLine, 0.5);
        
        for (let x = 0; x <= gridSize * 2; x += gridSize) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, gridSize * 2);
        }
        for (let y = 0; y <= gridSize * 2; y += gridSize) {
            graphics.moveTo(0, y);
            graphics.lineTo(gridSize * 2, y);
        }
        graphics.strokePath();
        
        gridTexture = graphics.generateTexture('gridTile', gridSize, gridSize);
        graphics.destroy();
    }

    function create() {
        createGridTexture(this);
        
        gridSprite = this.add.tileSprite(0, 0, this.cameras.main.width + 100, this.cameras.main.height + 100, 'gridTile');
        gridSprite.setOrigin(0, 0);
        gridSprite.setDepth(-10);

        this.snakeBodyGraphics = this.add.graphics();
        this.snakeBodyGraphics.setDepth(10);
        
        this.snakeHeadGraphics = this.add.graphics();
        this.snakeHeadGraphics.setDepth(20);

        this.foodGraphics = this.add.graphics();
        this.foodGraphics.setDepth(5);
        
        this.boundaryGraphics = this.add.graphics();
        this.boundaryGraphics.setDepth(1);
        
        this.uiGraphics = this.add.graphics();
        this.uiGraphics.setDepth(100);

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

        if (isMobile) {
            uiElements.joystickGraphics = this.add.graphics();
            uiElements.joystickGraphics.setDepth(99);
        }

        this.input.on('pointermove', (pointer) => {
            if (isMobile && touchJoystick.active) {
                touchJoystick.currentX = pointer.x;
                touchJoystick.currentY = pointer.y;
                const dx = touchJoystick.currentX - touchJoystick.startX;
                const dy = touchJoystick.currentY - touchJoystick.startY;
                if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                    inputState.angle = Math.atan2(dy, dx);
                }
            } else if (!isMobile) {
                const centerX = this.cameras.main.width / 2;
                const centerY = this.cameras.main.height / 2;
                inputState.angle = Math.atan2(pointer.y - centerY, pointer.x - centerX);
            }
        });

        if (!isMobile) {
            this.input.keyboard.on('keydown-SPACE', () => {
                inputState.boosting = true;
            });

            this.input.keyboard.on('keyup-SPACE', () => {
                inputState.boosting = false;
            });
        }

        this.input.on('pointerdown', (pointer) => {
            if (isMobile) {
                touchJoystick.active = true;
                touchJoystick.startX = pointer.x;
                touchJoystick.startY = pointer.y;
                touchJoystick.currentX = pointer.x;
                touchJoystick.currentY = pointer.y;
                
                if (pointer.x > this.cameras.main.width * 0.7) {
                    inputState.boosting = true;
                }
            } else {
                inputState.boosting = true;
            }
        });

        this.input.on('pointerup', () => {
            if (isMobile) {
                touchJoystick.active = false;
            }
            inputState.boosting = false;
        });

        const controlsHint = document.getElementById('controls-hint');
        if (controlsHint && isMobile) {
            controlsHint.innerHTML = 'Drag: Move | Tap Right Side: Boost';
        }

        lastPredictionTime = performance.now();
    }

    function sendInput() {
        const now = Date.now();
        const angleDiff = Math.abs(inputState.angle - lastInputState.angle);
        const boostChanged = inputState.boosting !== lastInputState.boosting;

        if (now - lastInputTime > INPUT_THROTTLE_MS || angleDiff > 0.05 || boostChanged) {
            socket.emit('input', inputState);
            lastInputState.angle = inputState.angle;
            lastInputState.boosting = inputState.boosting;
            lastInputTime = now;
        }
    }

    function update(time, delta) {
        if (!myId) return;

        sendInput();

        const now = performance.now();
        interpolationFactor = Math.min((now - lastNetworkUpdate) / networkInterval, 1.5);

        updatePredictedPlayer(delta);

        const myPlayer = predictedPlayer || gameState.players[myId];
        if (myPlayer && myPlayer.segments && myPlayer.segments.length > 0) {
            const head = myPlayer.segments[0];
            targetCamera.x = head.x;
            targetCamera.y = head.y;
        }

        camera.x = lerp(camera.x, targetCamera.x, CAMERA_LERP);
        camera.y = lerp(camera.y, targetCamera.y, CAMERA_LERP);

        if (gridSprite) {
            gridSprite.tilePositionX = camera.x;
            gridSprite.tilePositionY = camera.y;
        }

        this.snakeBodyGraphics.clear();
        this.snakeHeadGraphics.clear();
        this.foodGraphics.clear();
        this.boundaryGraphics.clear();
        this.uiGraphics.clear();

        drawBoundary.call(this);
        drawFood.call(this);
        drawSnakes.call(this);
        drawUI.call(this);

        if (isMobile && touchJoystick.active && uiElements.joystickGraphics) {
            drawJoystick.call(this);
        } else if (uiElements.joystickGraphics) {
            uiElements.joystickGraphics.clear();
        }
    }

    function drawJoystick() {
        const graphics = uiElements.joystickGraphics;
        graphics.clear();
        
        graphics.fillStyle(0xffffff, 0.2);
        graphics.fillCircle(touchJoystick.startX, touchJoystick.startY, 60);
        
        graphics.fillStyle(0xffffff, 0.5);
        const dx = touchJoystick.currentX - touchJoystick.startX;
        const dy = touchJoystick.currentY - touchJoystick.startY;
        const dist = Math.min(Math.sqrt(dx * dx + dy * dy), 50);
        const angle = Math.atan2(dy, dx);
        const thumbX = touchJoystick.startX + Math.cos(angle) * dist;
        const thumbY = touchJoystick.startY + Math.sin(angle) * dist;
        graphics.fillCircle(thumbX, thumbY, 25);
    }

    function drawBoundary() {
        const graphics = this.boundaryGraphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        const boundaryScreenX = centerX - camera.x;
        const boundaryScreenY = centerY - camera.y;

        graphics.lineStyle(8, 0xff4444, 0.8);
        graphics.strokeCircle(boundaryScreenX, boundaryScreenY, mapRadius);

        if (qualityLevel !== 'low') {
            graphics.lineStyle(20, 0xff4444, 0.2);
            graphics.strokeCircle(boundaryScreenX, boundaryScreenY, mapRadius);
        }

        const myPlayer = predictedPlayer || gameState.players[myId];
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
        const graphics = this.foodGraphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const foodSize = qualityLevel === 'low' ? 6 : 8;

        const foodByColor = new Map();
        
        for (const food of gameState.food) {
            const screenX = centerX + (food.x - camera.x);
            const screenY = centerY + (food.y - camera.y);

            if (screenX < -20 || screenX > width + 20 ||
                screenY < -20 || screenY > height + 20) {
                continue;
            }

            const color = getColor(food.color);
            if (!foodByColor.has(color)) {
                foodByColor.set(color, []);
            }
            foodByColor.get(color).push({ screenX, screenY });
        }

        for (const [color, positions] of foodByColor) {
            graphics.fillStyle(color, 1);
            for (const pos of positions) {
                graphics.fillCircle(pos.screenX, pos.screenY, foodSize);
            }
        }

        if (qualityLevel !== 'low') {
            graphics.fillStyle(0xffffff, 0.3);
            for (const [color, positions] of foodByColor) {
                for (const pos of positions) {
                    graphics.fillCircle(pos.screenX - 2, pos.screenY - 2, 3);
                }
            }
        }
    }

    function drawSnakes() {
        const bodyGraphics = this.snakeBodyGraphics;
        const headGraphics = this.snakeHeadGraphics;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;

        const sortedPlayers = Object.values(gameState.players).sort((a, b) => {
            if (a.id === myId) return 1;
            if (b.id === myId) return -1;
            return 0;
        });

        const activePlayerIds = new Set();
        const segmentSkip = qualityLevel === 'low' ? 2 : 1;

        for (const player of sortedPlayers) {
            if (!player.alive || !player.segments || player.segments.length === 0) continue;

            activePlayerIds.add(player.id);

            const isMe = player.id === myId;
            let renderPlayer = player;
            
            if (isMe && predictedPlayer) {
                renderPlayer = { ...player, segments: predictedPlayer.segments, angle: predictedPlayer.angle };
            } else if (!isMe) {
                renderPlayer = getInterpolatedPlayer(player.id) || player;
            }

            const color = getColor(renderPlayer.color);
            const segmentCount = renderPlayer.segments.length;

            if (qualityLevel !== 'low') {
                bodyGraphics.fillStyle(0x000000, 0.3);
                for (let i = segmentCount - 1; i >= 1; i -= segmentSkip) {
                    const seg = renderPlayer.segments[i];
                    const screenX = centerX + (seg.x - camera.x) + 4;
                    const screenY = centerY + (seg.y - camera.y) + 4;

                    if (screenX < -30 || screenX > width + 30 ||
                        screenY < -30 || screenY > height + 30) {
                        continue;
                    }

                    const size = 12 - (i / segmentCount) * 4;
                    bodyGraphics.fillCircle(screenX, screenY, size);
                }
            }

            bodyGraphics.fillStyle(color, 1);
            for (let i = segmentCount - 1; i >= 1; i -= segmentSkip) {
                const seg = renderPlayer.segments[i];
                const screenX = centerX + (seg.x - camera.x);
                const screenY = centerY + (seg.y - camera.y);

                if (screenX < -30 || screenX > width + 30 ||
                    screenY < -30 || screenY > height + 30) {
                    continue;
                }

                const size = 12 - (i / segmentCount) * 4;
                bodyGraphics.fillCircle(screenX, screenY, size);
            }

            if (isMe && qualityLevel !== 'low') {
                bodyGraphics.lineStyle(2, 0xffffff, 0.2);
                for (let i = segmentCount - 1; i >= 1; i -= segmentSkip * 2) {
                    const seg = renderPlayer.segments[i];
                    const screenX = centerX + (seg.x - camera.x);
                    const screenY = centerY + (seg.y - camera.y);

                    if (screenX < -30 || screenX > width + 30 ||
                        screenY < -30 || screenY > height + 30) {
                        continue;
                    }

                    const size = 12 - (i / segmentCount) * 4;
                    bodyGraphics.strokeCircle(screenX, screenY, size);
                }
            }

            const head = renderPlayer.segments[0];
            const headX = centerX + (head.x - camera.x);
            const headY = centerY + (head.y - camera.y);

            if (headX >= -30 && headX <= width + 30 &&
                headY >= -30 && headY <= height + 30) {

                if (qualityLevel !== 'low') {
                    headGraphics.fillStyle(0x000000, 0.3);
                    headGraphics.fillCircle(headX + 4, headY + 4, 12);
                }

                headGraphics.fillStyle(color, 1);
                headGraphics.fillCircle(headX, headY, 12);

                if (isMe) {
                    headGraphics.lineStyle(2, 0xffffff, 0.3);
                    headGraphics.strokeCircle(headX, headY, 12);
                }

                let angle = renderPlayer.angle || 0;
                if (renderPlayer.segments.length > 1) {
                    const next = renderPlayer.segments[1];
                    angle = Math.atan2(head.y - next.y, head.x - next.x);
                }

                const eyeOffset = 6;
                const eyeAngle1 = angle + Math.PI / 4;
                const eyeAngle2 = angle - Math.PI / 4;

                const eye1X = headX + Math.cos(eyeAngle1) * eyeOffset;
                const eye1Y = headY + Math.sin(eyeAngle1) * eyeOffset;
                const eye2X = headX + Math.cos(eyeAngle2) * eyeOffset;
                const eye2Y = headY + Math.sin(eyeAngle2) * eyeOffset;

                headGraphics.fillStyle(0xffffff, 1);
                headGraphics.fillCircle(eye1X, eye1Y, 5);
                headGraphics.fillCircle(eye2X, eye2Y, 5);

                const pupilOffset = 2;
                headGraphics.fillStyle(0x000000, 1);
                headGraphics.fillCircle(eye1X + Math.cos(angle) * pupilOffset, eye1Y + Math.sin(angle) * pupilOffset, 2.5);
                headGraphics.fillCircle(eye2X + Math.cos(angle) * pupilOffset, eye2Y + Math.sin(angle) * pupilOffset, 2.5);

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

        const leaderboardHeight = 30 + gameState.leaderboard.length * 25;
        graphics.fillStyle(0x000000, 0.7);
        graphics.fillRoundedRect(width - 220, 10, 210, leaderboardHeight, 8);

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

        const minimapSize = isMobile ? 100 : 150;
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
                const color = getColor(player.color);
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

        if (isMobile) {
            graphics.fillStyle(0xffffff, 0.15);
            graphics.fillCircle(width - 80, height - 100, 50);
        }
    }

    function setBoost(boosting) {
        inputState.boosting = boosting;
    }

    return { init, setBoost };
})();

window.onload = () => {
    MultiplayerGame.init();
};
