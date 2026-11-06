// ========================================================
// 🦆 EL JUEGO DE LA OCA - CLIENTE INTERACTIVO
// Tablero Espiral Caracol, Cámara Dinámica (Zoom) y WebSockets
// ========================================================

class OcaGameApp {
    constructor() {
        this.ws = null;
        this.room = null;
        this.myId = null;
        this.boardDef = null;
        this.boardCoords = [];
        this.isHost = false;
        this.isAnimating = false;

        // Customization
        this.selectedAvatar = '🪿';
        this.selectedColor = '#e63946';

        // Camera & Pan/Zoom
        this.camera = {
            x: 0,
            y: 0,
            scale: 1.0,
            isZoomed: false,
            isDragging: false,
            startX: 0,
            startY: 0,
            camStartX: 0,
            camStartY: 0,
            pinchDist: 0,
            pinchScale: 1.0,
            targetTile: 0,
        };

        // Audio
        this.soundEnabled = true;

        // Confetti
        this.confettiCanvas = document.getElementById('confetti-canvas');
        this.confettiCtx = this.confettiCanvas.getContext('2d');
        this.confettiParticles = [];
        this.confettiAnimId = null;

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupCameraGestures();
        this.setupConfetti();
        await this.loadBoardData();
        this.renderBoardSVG();

        // Check URL parameters for direct room join (e.g. ?room=OC24)
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            document.getElementById('join-code-input').value = roomParam.toUpperCase();
            this.switchTab('tab-join', 'panel-join');
        }

        this.connectWebSocket();
    }

    // ========================================================
    // 1. BOARD DATA & SVG RENDERING (NAUTILUS SPIRAL)
    // ========================================================
    async loadBoardData() {
        try {
            const res = await fetch('/api/board');
            if (res.ok) {
                const data = await res.json();
                this.boardDef = data.tiles;
            }
        } catch (e) {
            console.warn('Usando definición de tablero por defecto');
        }

        if (!this.boardDef) {
            this.boardDef = this.generateFallbackBoard();
        }

        // Precompute pixel coordinates on 1000x890 SVG viewport
        this.boardCoords = this.boardDef.map(tile => {
            const x = (tile.x_pct / 100.0) * 1000;
            const y = (tile.y_pct / 100.0) * 890;
            const angle = tile.angle_deg || 0;
            return { x, y, angle, tile };
        });
    }

    generateFallbackBoard() {
        const tiles = [];
        tiles.push({
            number: 0,
            tile_type: 'normal',
            name: 'Salida',
            x_pct: 6.5,
            y_pct: 58.4,
            angle_deg: 275
        });

        for (let i = 1; i <= 63; i++) {
            let t = 'normal';
            if ([5, 9, 14, 18, 23, 27, 32, 36, 41, 45, 50, 54, 59].includes(i)) t = 'oca';
            else if (i === 6 || i === 12) t = 'puente';
            else if (i === 26 || i === 53) t = 'dados';
            else if (i === 19) t = 'posada';
            else if (i === 31) t = 'pozo';
            else if (i === 42) t = 'laberinto';
            else if (i === 52) t = 'carcel';
            else if (i === 58) t = 'muerte';
            else if (i === 63) t = 'meta';

            tiles.push({
                number: i,
                tile_type: t,
                name: `Casilla ${i}`,
                x_pct: 50,
                y_pct: 50,
                angle_deg: 0
            });
        }
        return tiles;
    }

    renderBoardSVG() {
        const bgDecor = document.getElementById('svg-bg-decor');
        const tilesGroup = document.getElementById('svg-tiles-group');
        const vignettesGroup = document.getElementById('svg-vignettes-group');
        const gardenGroup = document.getElementById('svg-garden-group');
        const spiralPath = document.getElementById('board-spiral-path');
        const railOuter = document.getElementById('board-rail-outer');
        const railInner = document.getElementById('board-rail-inner');

        if (!tilesGroup || this.boardCoords.length === 0) return;

        tilesGroup.innerHTML = '';
        vignettesGroup.innerHTML = '';
        gardenGroup.innerHTML = '';
        bgDecor.innerHTML = '';

        // 1. Antique Parchment Compass Rose & Corner Flourishes
        bgDecor.innerHTML = `
            <!-- Vintage Nautical Compass Rose -->
            <g transform="translate(500, 445)">
                <circle r="360" fill="none" stroke="#8d5b28" stroke-width="1.5" stroke-dasharray="3,3"/>
                <circle r="260" fill="none" stroke="#8d5b28" stroke-width="1" stroke-dasharray="2,4"/>
                <circle r="160" fill="none" stroke="#8d5b28" stroke-width="0.8"/>
                
                <!-- Compass Points -->
                <polygon points="0,-360 12,-160 0,-180 -12,-160" fill="#a0522d"/>
                <polygon points="0,360 12,160 0,180 -12,160" fill="#a0522d"/>
                <polygon points="360,0 160,12 180,0 160,-12" fill="#a0522d"/>
                <polygon points="-360,0 -160,12 -180,0 -160,-12" fill="#a0522d"/>

                <text y="-370" text-anchor="middle" font-family="'Playfair Display', serif" font-size="20" font-weight="bold" fill="#7f4f24">N</text>
                <text y="390" text-anchor="middle" font-family="'Playfair Display', serif" font-size="20" font-weight="bold" fill="#7f4f24">S</text>
                <text x="385" y="7" text-anchor="middle" font-family="'Playfair Display', serif" font-size="20" font-weight="bold" fill="#7f4f24">E</text>
                <text x="-385" y="7" text-anchor="middle" font-family="'Playfair Display', serif" font-size="20" font-weight="bold" fill="#7f4f24">O</text>
            </g>

            <!-- Corner Vintage Vignettes -->
            <g transform="translate(60, 60)">
                <path d="M0,0 Q60,10 100,50 Q10,60 0,0" fill="none" stroke="#936639" stroke-width="2"/>
                <text x="20" y="30" font-size="16">🪿</text>
            </g>
            <g transform="translate(940, 60) scale(-1, 1)">
                <path d="M0,0 Q60,10 100,50 Q10,60 0,0" fill="none" stroke="#936639" stroke-width="2"/>
            </g>
            <g transform="translate(940, 830) scale(-1, -1)">
                <path d="M0,0 Q60,10 100,50 Q10,60 0,0" fill="none" stroke="#936639" stroke-width="2"/>
            </g>
            <g transform="translate(60, 830) scale(1, -1)">
                <path d="M0,0 Q60,10 100,50 Q10,60 0,0" fill="none" stroke="#936639" stroke-width="2"/>
            </g>
        `;

        // 2. Generate smooth continuous curve through tile centers
        let pathD = `M ${this.boardCoords[1].x} ${this.boardCoords[1].y}`;
        for (let i = 2; i < this.boardCoords.length - 1; i++) {
            pathD += ` L ${this.boardCoords[i].x} ${this.boardCoords[i].y}`;
        }
        spiralPath.setAttribute('d', pathD);

        // 3. Render Each Tile (1..=62) rotated along tangent
        this.boardCoords.forEach(({ x, y, angle, tile }) => {
            if (tile.number === 0) {
                // Starting Nest
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${x}, ${y})`);
                g.innerHTML = `
                    <circle r="36" fill="#8d5b28" stroke="#ffb703" stroke-width="3" filter="url(#tileDropShadow)"/>
                    <circle r="30" fill="#f4ebd0" stroke="#a07844" stroke-width="1.5" stroke-dasharray="4,2"/>
                    <text y="-10" text-anchor="middle" font-size="11" font-weight="900" fill="#582f0e">SALIDA</text>
                    <text y="14" text-anchor="middle" font-size="24">🪺</text>
                `;
                tilesGroup.appendChild(g);
                return;
            }

            if (tile.number === 63) {
                // Grand Golden Center Garden Medallion
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${x}, ${y})`);
                g.innerHTML = `
                    <!-- Center Grand Garden Medallion -->
                    <circle r="78" fill="url(#gardenGrad)" stroke="#582f0e" stroke-width="5" filter="url(#medallionGlow)"/>
                    <circle r="68" fill="#fefae0" stroke="#d4a373" stroke-width="2"/>
                    <circle r="62" fill="#90e0ef" opacity="0.35"/>
                    <circle r="60" fill="none" stroke="#ffb703" stroke-width="2" stroke-dasharray="6,4"/>

                    <text y="-38" text-anchor="middle" font-family="'Playfair Display', serif" font-size="18" fill="#7f4f24" font-weight="900" letter-spacing="1">META 63</text>
                    
                    <!-- Majestic Crowned Goose Artwork -->
                    <g transform="translate(0, 2)">
                        <text y="-2" text-anchor="middle" font-size="20">👑</text>
                        <text y="24" text-anchor="middle" font-size="46">🦆</text>
                        <text y="38" text-anchor="middle" font-size="14">🪷</text>
                    </g>

                    <text y="52" text-anchor="middle" font-family="'Playfair Display', serif" font-size="12" fill="#582f0e" font-weight="900" letter-spacing="0.5">JARDÍN DE LA OCA</text>
                `;
                gardenGroup.appendChild(g);
                return;
            }

            // Normal and Special Tiles (1..=62)
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `svg-tile-item tile-${tile.tile_type}`);
            g.setAttribute('data-tile', tile.number);

            let fillColor = '#fffdf7';
            let strokeColor = '#8a5a36';
            let strokeWidth = '1.8';
            let iconDrawing = '';

            switch (tile.tile_type) {
                case 'oca':
                    fillColor = '#e9f5ed';
                    strokeColor = '#2a9d8f';
                    strokeWidth = '2.5';
                    iconDrawing = this.createGooseArtwork();
                    break;
                case 'puente':
                    fillColor = '#e8f4f8';
                    strokeColor = '#457b9d';
                    strokeWidth = '2.5';
                    iconDrawing = this.createBridgeArtwork();
                    break;
                case 'dados':
                    fillColor = '#f3e8ff';
                    strokeColor = '#9b5de5';
                    strokeWidth = '2.5';
                    iconDrawing = this.createDiceArtwork();
                    break;
                case 'posada':
                    fillColor = '#fff1e6';
                    strokeColor = '#e76f51';
                    strokeWidth = '2.5';
                    iconDrawing = this.createInnArtwork();
                    break;
                case 'pozo':
                    fillColor = '#eef3ef';
                    strokeColor = '#52796f';
                    strokeWidth = '2.5';
                    iconDrawing = this.createWellArtwork();
                    break;
                case 'laberinto':
                    fillColor = '#e3fafc';
                    strokeColor = '#0077b6';
                    strokeWidth = '2.5';
                    iconDrawing = this.createMazeArtwork();
                    break;
                case 'carcel':
                    fillColor = '#ede9fe';
                    strokeColor = '#4a4e69';
                    strokeWidth = '2.5';
                    iconDrawing = this.createPrisonArtwork();
                    break;
                case 'muerte':
                    fillColor = '#ffe3e3';
                    strokeColor = '#c1121f';
                    strokeWidth = '3';
                    iconDrawing = this.createSkullArtwork();
                    break;
            }

            // Rotate tile to follow track contour
            const rot = angle;

            g.innerHTML = `
                <g transform="translate(${x}, ${y}) rotate(${rot})">
                    <!-- Tile Capsule / Stepping Stone -->
                    <rect class="svg-tile-capsule" x="-33" y="-23" width="66" height="46" rx="9" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
                    
                    <!-- Number Badge -->
                    <rect x="-31" y="-21" width="22" height="15" rx="5" fill="#f2e2be" stroke="${strokeColor}" stroke-width="0.8"/>
                    <text class="svg-tile-text-num" x="-20" y="-13">${tile.number}</text>

                    <!-- Icon or Artwork -->
                    <g transform="translate(6, 0)">
                        ${iconDrawing}
                    </g>
                </g>
            `;

            tilesGroup.appendChild(g);
        });

        this.renderPlayerTokens();
    }

    // ========================================================
    // SVG ARTWORK HELPERS FOR SPECIAL TILES
    // ========================================================
    createGooseArtwork() {
        return `
            <circle r="13" fill="#2a9d8f" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">🦆</text>
        `;
    }

    createBridgeArtwork() {
        return `
            <circle r="13" fill="#457b9d" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">🌉</text>
        `;
    }

    createDiceArtwork() {
        return `
            <circle r="13" fill="#9b5de5" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">🎲</text>
        `;
    }

    createInnArtwork() {
        return `
            <circle r="13" fill="#e76f51" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">🏨</text>
        `;
    }

    createWellArtwork() {
        return `
            <circle r="13" fill="#52796f" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">🕳️</text>
        `;
    }

    createMazeArtwork() {
        return `
            <circle r="13" fill="#0077b6" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">🌀</text>
        `;
    }

    createPrisonArtwork() {
        return `
            <circle r="13" fill="#4a4e69" opacity="0.18"/>
            <text y="4" text-anchor="middle" font-size="18">⛓️</text>
        `;
    }

    createSkullArtwork() {
        return `
            <circle r="13" fill="#c1121f" opacity="0.25"/>
            <text y="4" text-anchor="middle" font-size="18">💀</text>
        `;
    }

    renderPlayerTokens() {
        const tokensGroup = document.getElementById('svg-tokens-group');
        if (!tokensGroup || !this.room) return;

        tokensGroup.innerHTML = '';

        const posMap = {};
        this.room.players.forEach(p => {
            if (!posMap[p.position]) posMap[p.position] = [];
            posMap[p.position].push(p);
        });

        Object.entries(posMap).forEach(([posStr, playersOnTile]) => {
            const pos = parseInt(posStr, 10);
            const coords = this.boardCoords[pos] || this.boardCoords[0];

            playersOnTile.forEach((player, idx) => {
                const totalOnTile = playersOnTile.length;
                let offsetX = 0;
                let offsetY = 0;

                if (totalOnTile > 1) {
                    const angle = (idx / totalOnTile) * Math.PI * 2;
                    const radius = 18;
                    offsetX = Math.cos(angle) * radius;
                    offsetY = Math.sin(angle) * radius;
                }

                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('id', `token-group-${player.id}`);
                g.setAttribute('class', 'token-group');
                g.setAttribute('transform', `translate(${coords.x + offsetX}, ${coords.y + offsetY})`);

                g.innerHTML = `
                    <circle class="token-circle" r="16" fill="${player.color}"/>
                    <text class="token-avatar" y="2">${player.avatar}</text>
                `;
                tokensGroup.appendChild(g);
            });
        });

        this.updateRaceRadar();
    }

    // ========================================================
    // 2. CAMERA ENGINE (DYNAMIC AUTO-FOLLOW & PAN-ZOOM)
    // ========================================================
    setupCameraGestures() {
        const viewport = document.getElementById('board-viewport');
        const cameraEl = document.getElementById('board-camera');
        if (!viewport || !cameraEl) return;

        // Pointer drag & gestures
        let isDown = false;
        let lastTouches = [];

        viewport.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.board-camera-controls')) return;
            isDown = true;
            this.camera.isDragging = true;
            viewport.classList.add('grabbing');
            cameraEl.classList.remove('camera-smooth');

            this.camera.startX = e.clientX;
            this.camera.startY = e.clientY;
            this.camera.camStartX = this.camera.x;
            this.camera.camStartY = this.camera.y;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDown) return;
            const dx = e.clientX - this.camera.startX;
            const dy = e.clientY - this.camera.startY;
            this.camera.x = this.camera.camStartX + dx;
            this.camera.y = this.camera.camStartY + dy;
            this.applyCameraTransform();
        });

        window.addEventListener('pointerup', () => {
            if (isDown) {
                isDown = false;
                this.camera.isDragging = false;
                viewport.classList.remove('grabbing');
            }
        });

        // Touch Pinch-to-zoom
        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                this.camera.pinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                this.camera.pinchScale = this.camera.scale;
                cameraEl.classList.remove('camera-smooth');
            }
        }, { passive: true });

        viewport.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                if (this.camera.pinchDist > 0) {
                    const ratio = dist / this.camera.pinchDist;
                    this.camera.scale = Math.min(Math.max(this.camera.pinchScale * ratio, 0.9), 3.2);
                    this.applyCameraTransform();
                }
            }
        }, { passive: true });

        // Mouse Wheel Zoom
        viewport.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.15 : -0.15;
            this.camera.scale = Math.min(Math.max(this.camera.scale + delta, 0.9), 3.0);
            cameraEl.classList.remove('camera-smooth');
            this.applyCameraTransform();
        }, { passive: false });

        // Double-tap to toggle zoom
        let lastTap = 0;
        viewport.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                this.toggleCameraZoom();
            }
            lastTap = now;
        });

        // Buttons
        document.getElementById('btn-camera-toggle').addEventListener('click', () => {
            this.toggleCameraZoom();
        });

        document.getElementById('btn-camera-center-me').addEventListener('click', () => {
            this.centerOnMyToken();
        });

        document.getElementById('btn-zoom-in').addEventListener('click', () => {
            this.camera.scale = Math.min(this.camera.scale + 0.35, 3.0);
            this.camera.isZoomed = true;
            this.updateCameraPillText();
            this.applyCameraTransform(true);
        });

        document.getElementById('btn-zoom-out').addEventListener('click', () => {
            this.camera.scale = Math.max(this.camera.scale - 0.35, 0.9);
            if (this.camera.scale <= 1.05) this.camera.isZoomed = false;
            this.updateCameraPillText();
            this.applyCameraTransform(true);
        });

        document.getElementById('btn-zoom-reset').addEventListener('click', () => {
            this.resetCameraToFullView();
        });
    }

    applyCameraTransform(smooth = false) {
        const cameraEl = document.getElementById('board-camera');
        if (!cameraEl) return;

        if (smooth) {
            cameraEl.classList.add('camera-smooth');
        } else {
            cameraEl.classList.remove('camera-smooth');
        }

        cameraEl.style.transform = `translate3d(${this.camera.x}px, ${this.camera.y}px, 0) scale(${this.camera.scale})`;
    }

    toggleCameraZoom() {
        this.camera.isZoomed = !this.camera.isZoomed;
        this.updateCameraPillText();

        if (this.camera.isZoomed) {
            this.focusCameraOnTile(this.camera.targetTile || 1, true);
        } else {
            this.resetCameraToFullView();
        }
    }

    updateCameraPillText() {
        const pill = document.getElementById('btn-camera-toggle');
        const text = document.getElementById('cam-mode-text');
        if (!pill || !text) return;

        if (this.camera.isZoomed) {
            pill.classList.add('active');
            text.textContent = 'Zoom Acción';
        } else {
            pill.classList.remove('active');
            text.textContent = 'Vista Completa';
        }
    }

    resetCameraToFullView() {
        this.camera.isZoomed = false;
        this.camera.scale = 1.0;
        this.camera.x = 0;
        this.camera.y = 0;
        this.updateCameraPillText();
        this.applyCameraTransform(true);
    }

    focusCameraOnTile(tileNum, smooth = true) {
        const viewport = document.getElementById('board-viewport');
        if (!viewport || this.boardCoords.length === 0) return;

        const coords = this.boardCoords[tileNum] || this.boardCoords[0];
        this.camera.targetTile = tileNum;

        const isMobile = window.innerWidth < 768;
        const targetScale = isMobile ? 2.2 : 1.7;
        this.camera.scale = targetScale;
        this.camera.isZoomed = true;
        this.updateCameraPillText();

        const vWidth = viewport.clientWidth;
        const vHeight = viewport.clientHeight;

        // Position of tile in 1000x890 coordinate space
        const targetX = (vWidth / 2) - (coords.x * (vWidth / 1000)) * targetScale;
        const targetY = (vHeight / 2) - (coords.y * (vHeight / 890)) * targetScale;

        this.camera.x = targetX;
        this.camera.y = targetY;

        this.applyCameraTransform(smooth);
    }

    centerOnMyToken() {
        if (!this.room || !this.myId) return;
        const me = this.room.players.find(p => p.id === this.myId);
        if (me) {
            this.focusCameraOnTile(me.position, true);
        }
    }

    updateRaceRadar() {
        const container = document.getElementById('radar-runners');
        if (!container || !this.room) return;

        container.innerHTML = '';
        this.room.players.forEach(p => {
            const dot = document.createElement('div');
            dot.className = 'radar-runner-dot';
            dot.style.backgroundColor = p.color;
            const pct = Math.min((p.position / 63) * 100, 100);
            dot.style.left = `${pct}%`;
            dot.textContent = p.avatar;
            dot.title = `${p.name} (Casilla ${p.position})`;

            dot.addEventListener('click', () => {
                this.focusCameraOnTile(p.position, true);
            });

            container.appendChild(dot);
        });
    }

    // ========================================================
    // 3. WEBSOCKET CONNECTION
    // ========================================================
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Conectado al servidor de El Juego de la Oca');
            if (this.pingInterval) clearInterval(this.pingInterval);
            this.pingInterval = setInterval(() => {
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.send({ action: 'ping' });
                }
            }, 30000);
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (e) {
                console.error('Error parseando mensaje:', e);
            }
        };

        this.ws.onclose = () => {
            console.warn('Conexión perdida con el servidor. Reconectando en 3s...');
            setTimeout(() => this.connectWebSocket(), 3000);
        };
    }

    send(msg) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        }
    }

    // ========================================================
    // 4. SERVER MESSAGES HANDLING
    // ========================================================
    handleServerMessage(data) {
        switch (data.type) {
            case 'room_created':
                this.myId = data.my_id;
                this.isHost = true;
                this.room = data.room;
                this.showWaitingLobby();
                break;

            case 'room_joined':
                this.myId = data.my_id;
                this.room = data.room;
                this.isHost = (this.room.host_id === this.myId);
                this.showWaitingLobby();
                break;

            case 'room_state':
                this.room = data.room;
                this.isHost = (this.room.host_id === this.myId);
                this.updateRoomStateUI();
                break;

            case 'game_started':
                this.room = data.room;
                this.showGameView();
                break;

            case 'turn_event':
                this.handleTurnEvent(data.event);
                break;

            case 'chat_message':
                this.addChatMessage(data.chat);
                break;

            case 'error':
                alert(data.message);
                break;

            case 'pong':
                break;
        }
    }

    // ========================================================
    // 5. GAME FLOW & ACTION-CAM ANIMATIONS
    // ========================================================
    async handleTurnEvent(event) {
        this.isAnimating = true;
        const rollBtn = document.getElementById('btn-roll-dice');
        if (rollBtn) rollBtn.disabled = true;

        // 1. Auto-Follow Camera: Focus on active token as soon as turn begins
        this.focusCameraOnTile(event.from_pos, true);

        // 2. Animate Dice Roll
        this.animateDiceRoll(event.dice, event.total);
        if (window.ocaAudio) window.ocaAudio.playDiceRoll();

        await this.sleep(850);

        // 3. Hop through path and camera follows dynamically!
        if (event.path && event.path.length > 0) {
            for (let i = 0; i < event.path.length; i++) {
                const stepPos = event.path[i];
                this.moveTokenTo(event.player_id, stepPos);
                // Action cam keeps following active player
                this.focusCameraOnTile(stepPos, true);

                if (window.ocaAudio) window.ocaAudio.playStep();
                await this.sleep(260);
            }
        }

        // 4. Handle Special Tile Triggers & Rhymes
        if (event.rhyme) {
            this.showRhymeBanner(event.tile_type, event.rhyme);
        }

        // Audio cues for special tiles
        if (window.ocaAudio) {
            switch (event.tile_type) {
                case 'oca':
                    window.ocaAudio.playGooseHonk();
                    break;
                case 'puente':
                    window.ocaAudio.playBridge();
                    break;
                case 'posada':
                case 'pozo':
                case 'carcel':
                    window.ocaAudio.playTrap();
                    break;
                case 'muerte':
                    window.ocaAudio.playDeath();
                    break;
                case 'meta':
                    window.ocaAudio.playVictory();
                    break;
            }
        }

        // 5. Log event & update radar
        this.addLogEntry(event);
        this.updateRaceRadar();

        // 6. Handle Win
        if (event.is_win) {
            this.showVictoryModal(event.player_name);
            this.startConfetti();
        }

        this.isAnimating = false;
        this.updateTurnControls();
    }

    animateDiceRoll(dice, total) {
        const d1 = document.getElementById('die-1');
        const d2 = document.getElementById('die-2');
        const totalDisplay = document.getElementById('dice-total-num');

        if (!d1 || !d2) return;

        d1.classList.add('rolling');
        d2.classList.add('rolling');

        setTimeout(() => {
            d1.classList.remove('rolling');
            d2.classList.remove('rolling');

            d1.setAttribute('data-value', dice[0] || 1);
            d2.setAttribute('data-value', dice[1] || 1);

            if (dice[1] === 0) {
                d2.style.display = 'none';
            } else {
                d2.style.display = 'grid';
            }

            totalDisplay.textContent = total;
        }, 600);
    }

    moveTokenTo(playerId, tileNum) {
        const token = document.getElementById(`token-group-${playerId}`);
        const coords = this.boardCoords[tileNum];
        if (!token || !coords) return;

        token.setAttribute('transform', `translate(${coords.x}, ${coords.y})`);
    }

    showRhymeBanner(tileType, rhymeText) {
        const banner = document.getElementById('rhyme-banner');
        const badge = document.getElementById('rhyme-badge');
        const title = document.getElementById('rhyme-title');
        const text = document.getElementById('rhyme-text');

        let icon = '🦆';
        let headline = '¡De oca a oca!';

        if (tileType === 'puente') {
            icon = '🌉';
            headline = '¡De puente a puente!';
        } else if (tileType === 'dados') {
            icon = '🎲';
            headline = '¡De dados a dados!';
        } else if (tileType === 'laberinto') {
            icon = '🌀';
            headline = '¡Del laberinto al 30!';
        } else if (tileType === 'muerte') {
            icon = '💀';
            headline = '¡La Muerte!';
        } else if (tileType === 'pozo') {
            icon = '🕳️';
            headline = '¡Caíste en el Pozo!';
        } else if (tileType === 'carcel') {
            icon = '⛓️';
            headline = '¡A la Cárcel!';
        } else if (tileType === 'posada') {
            icon = '🏨';
            headline = '¡La Posada!';
        }

        badge.textContent = icon;
        title.textContent = headline;
        text.textContent = rhymeText;

        banner.classList.remove('hidden');

        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.bannerTimeout = setTimeout(() => {
            banner.classList.add('hidden');
        }, 4000);
    }

    // ========================================================
    // 6. UI VIEWS & UPDATES
    // ========================================================
    switchView(viewId) {
        document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
        const target = document.getElementById(viewId);
        if (target) target.classList.add('active');

        const leaveBtn = document.getElementById('btn-leave');
        if (leaveBtn) {
            leaveBtn.classList.toggle('hidden', viewId === 'lobby-view');
        }
    }

    showWaitingLobby() {
        this.switchView('room-lobby-view');
        document.getElementById('display-room-code').textContent = this.room.code;

        // Render QR Code
        const qrContainer = document.getElementById('qrcode-container');
        qrContainer.innerHTML = '';
        const roomUrl = `${window.location.origin}${window.location.pathname}?room=${this.room.code}`;
        new QRCode(qrContainer, {
            text: roomUrl,
            width: 140,
            height: 140,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });

        this.updateWaitingPlayersList();

        const hostControls = document.getElementById('host-controls');
        const guestControls = document.getElementById('guest-controls');
        if (this.isHost) {
            hostControls.classList.remove('hidden');
            guestControls.classList.add('hidden');
        } else {
            hostControls.classList.add('hidden');
            guestControls.classList.remove('hidden');
        }
    }

    updateWaitingPlayersList() {
        const list = document.getElementById('waiting-players-list');
        const count = document.getElementById('players-count');
        if (!list || !this.room) return;

        count.textContent = this.room.players.length;
        list.innerHTML = '';

        this.room.players.forEach(p => {
            const li = document.createElement('li');
            li.className = 'waiting-player-item';
            li.style.borderLeftColor = p.color;

            const isHostP = (p.id === this.room.host_id);
            li.innerHTML = `
                <div class="waiting-player-info">
                    <span class="waiting-player-avatar">${p.avatar}</span>
                    <span class="waiting-player-name">${p.name}</span>
                    ${isHostP ? '<span class="host-tag">ANFITRIÓN</span>' : ''}
                    ${p.is_bot ? '<span class="bot-tag">BOT IA</span>' : ''}
                </div>
            `;
            list.appendChild(li);
        });
    }

    showGameView() {
        this.switchView('game-view');
        this.renderPlayerTokens();
        this.updateRoomStateUI();
        this.resetCameraToFullView();
    }

    updateRoomStateUI() {
        if (!this.room) return;

        if (this.room.status === 'waiting') {
            this.updateWaitingPlayersList();
            return;
        }

        const currPlayer = this.room.players[this.room.current_turn];
        if (currPlayer) {
            document.getElementById('turn-avatar').textContent = currPlayer.avatar;
            document.getElementById('turn-name').textContent = currPlayer.name;

            const statusBadge = document.getElementById('turn-status-badge');
            if (currPlayer.turns_to_wait > 0) {
                statusBadge.textContent = `Castigo (${currPlayer.turns_to_wait} turnos)`;
            } else {
                statusBadge.textContent = 'En turno para tirar';
            }
        }

        // Standings leaderboard in sidebar (click to fly camera!)
        const listContainer = document.getElementById('game-players-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            const sorted = [...this.room.players].sort((a, b) => b.position - a.position);

            sorted.forEach(p => {
                const item = document.createElement('div');
                const isCurr = currPlayer && (p.id === currPlayer.id);
                item.className = `game-player-item ${isCurr ? 'current-turn' : ''}`;
                item.style.borderLeft = `4px solid ${p.color}`;
                item.style.cursor = 'pointer';
                item.title = `Toca para enfocar a ${p.name}`;

                let trapTag = '';
                if (p.in_well) trapTag = '<span class="game-player-trap">🕳️ En el Pozo</span>';
                else if (p.position === 19 && p.turns_to_wait > 0) trapTag = '<span class="game-player-trap">🏨 Posada</span>';
                else if (p.position === 52 && p.turns_to_wait > 0) trapTag = '<span class="game-player-trap">⛓️ Cárcel</span>';

                item.innerHTML = `
                    <span class="game-player-avatar">${p.avatar}</span>
                    <span class="game-player-name">${p.name}</span>
                    ${trapTag}
                    <span class="game-player-pos">Casilla ${p.position}</span>
                `;

                // Tapping a player zooms the camera right onto their token
                item.addEventListener('click', () => {
                    this.focusCameraOnTile(p.position, true);
                });

                listContainer.appendChild(item);
            });
        }

        this.updateTurnControls();
        this.renderPlayerTokens();
    }

    updateTurnControls() {
        const rollBtn = document.getElementById('btn-roll-dice');
        if (!rollBtn || !this.room) return;

        if (this.room.status !== 'playing' || this.isAnimating) {
            rollBtn.disabled = true;
            return;
        }

        const currPlayer = this.room.players[this.room.current_turn];
        if (currPlayer && currPlayer.id === this.myId && !currPlayer.is_bot) {
            rollBtn.disabled = false;
        } else {
            rollBtn.disabled = true;
        }
    }

    addLogEntry(event) {
        const list = document.getElementById('events-log-list');
        if (!list) return;

        const entry = document.createElement('div');
        let typeClass = '';
        if (event.tile_type === 'oca') typeClass = 'oca';
        else if (event.tile_type === 'puente' || event.tile_type === 'dados') typeClass = 'puente';
        else if (['posada', 'pozo', 'carcel', 'muerte'].includes(event.tile_type)) typeClass = 'danger';

        entry.className = `log-entry ${typeClass}`;
        entry.textContent = event.message;

        list.prepend(entry);
    }

    addChatMessage(msg) {
        const list = document.getElementById('chat-messages-list');
        if (!list) return;

        const item = document.createElement('div');
        item.className = 'chat-item';
        item.innerHTML = `<span class="chat-author">${msg.sender_name}:</span> <span class="chat-text">${msg.text}</span>`;
        list.appendChild(item);
        list.scrollTop = list.scrollHeight;
    }

    showVictoryModal(winnerName) {
        const modal = document.getElementById('victory-modal');
        document.getElementById('winner-name').textContent = winnerName;
        modal.classList.remove('hidden');
    }

    // ========================================================
    // 7. EVENT LISTENERS
    // ========================================================
    setupEventListeners() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                this.switchTab(e.currentTarget.id, target);
            });
        });

        document.querySelectorAll('.log-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.log-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.log-body').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const target = document.getElementById(e.currentTarget.getAttribute('data-target'));
                if (target) target.classList.add('active');
            });
        });

        document.querySelectorAll('.avatar-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.selectedAvatar = e.currentTarget.getAttribute('data-avatar');
            });
        });

        document.querySelectorAll('.color-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.selectedColor = e.currentTarget.getAttribute('data-color');
            });
        });

        document.getElementById('btn-create-room').addEventListener('click', () => {
            const name = document.getElementById('player-name-input').value.trim() || 'Jugador 1';
            const twoDice = document.getElementById('chk-two-dice').checked;
            this.send({
                action: 'create_room',
                player_name: name,
                color: this.selectedColor,
                avatar: this.selectedAvatar,
                two_dice: twoDice
            });
        });

        document.getElementById('btn-join-room').addEventListener('click', () => {
            const code = document.getElementById('join-code-input').value.trim().toUpperCase();
            const name = document.getElementById('player-name-input').value.trim() || 'Jugador';
            if (!code) {
                alert('Por favor introduce el código de la sala');
                return;
            }
            this.send({
                action: 'join_room',
                room_code: code,
                player_name: name,
                color: this.selectedColor,
                avatar: this.selectedAvatar
            });
        });

        document.getElementById('btn-quick-solo').addEventListener('click', () => {
            const name = document.getElementById('player-name-input').value.trim() || 'Jugador 1';
            this.send({
                action: 'create_room',
                player_name: name,
                color: this.selectedColor,
                avatar: this.selectedAvatar,
                two_dice: true
            });
            setTimeout(() => {
                this.send({ action: 'add_bot' });
                this.send({ action: 'add_bot' });
                setTimeout(() => {
                    this.send({ action: 'start_game' });
                }, 400);
            }, 500);
        });

        document.getElementById('btn-add-bot').addEventListener('click', () => {
            this.send({ action: 'add_bot' });
        });

        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.send({ action: 'start_game' });
        });

        document.getElementById('btn-roll-dice').addEventListener('click', () => {
            this.send({ action: 'roll_dice' });
        });

        document.getElementById('btn-copy-code').addEventListener('click', () => {
            if (!this.room) return;
            const url = `${window.location.origin}${window.location.pathname}?room=${this.room.code}`;
            navigator.clipboard.writeText(url).then(() => {
                alert('¡Enlace de sala copiado al portapapeles!');
            }).catch(() => {
                navigator.clipboard.writeText(this.room.code);
                alert(`¡Código ${this.room.code} copiado!`);
            });
        });

        document.querySelectorAll('.btn-shout').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shout = e.currentTarget.getAttribute('data-shout');
                this.send({
                    action: 'send_chat',
                    text: shout
                });
            });
        });

        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (text) {
                this.send({ action: 'send_chat', text });
                input.value = '';
            }
        });

        document.getElementById('btn-sound').addEventListener('click', (e) => {
            if (window.ocaAudio) {
                this.soundEnabled = window.ocaAudio.toggleMute();
                e.currentTarget.textContent = this.soundEnabled ? '🔊' : '🔇';
            }
        });

        document.getElementById('btn-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').classList.remove('hidden');
        });
        document.getElementById('btn-close-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').classList.add('hidden');
        });
        document.getElementById('btn-got-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').classList.add('hidden');
        });

        document.getElementById('btn-leave').addEventListener('click', () => {
            if (confirm('¿Deseas salir de la sala actual?')) {
                window.location.reload();
            }
        });

        document.getElementById('btn-restart-game').addEventListener('click', () => {
            document.getElementById('victory-modal').classList.add('hidden');
            this.send({ action: 'restart_game' });
        });
        document.getElementById('btn-victory-back-lobby').addEventListener('click', () => {
            window.location.reload();
        });
    }

    switchTab(tabId, panelId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(p => p.classList.remove('active'));

        const tab = document.getElementById(tabId);
        const panel = document.getElementById(panelId);
        if (tab) tab.classList.add('active');
        if (panel) panel.classList.add('active');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========================================================
    // 8. CONFETTI CELEBRATION
    // ========================================================
    setupConfetti() {
        this.confettiCanvas.width = window.innerWidth;
        this.confettiCanvas.height = window.innerHeight;
        window.addEventListener('resize', () => {
            this.confettiCanvas.width = window.innerWidth;
            this.confettiCanvas.height = window.innerHeight;
        });
    }

    startConfetti() {
        const colors = ['#e63946', '#ffd166', '#2a9d8f', '#457b9d', '#f15bb5', '#8338ec'];
        this.confettiParticles = [];

        for (let i = 0; i < 150; i++) {
            this.confettiParticles.push({
                x: Math.random() * this.confettiCanvas.width,
                y: -Math.random() * this.confettiCanvas.height * 0.5,
                w: Math.random() * 10 + 6,
                h: Math.random() * 8 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                vx: (Math.random() - 0.5) * 4,
                vy: Math.random() * 4 + 3,
                angle: Math.random() * 360,
                vAngle: (Math.random() - 0.5) * 8
            });
        }

        const render = () => {
            this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
            let activeCount = 0;

            this.confettiParticles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                p.angle += p.vAngle;

                if (p.y < this.confettiCanvas.height) {
                    activeCount++;
                    this.confettiCtx.save();
                    this.confettiCtx.translate(p.x, p.y);
                    this.confettiCtx.rotate((p.angle * Math.PI) / 180);
                    this.confettiCtx.fillStyle = p.color;
                    this.confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    this.confettiCtx.restore();
                }
            });

            if (activeCount > 0) {
                this.confettiAnimId = requestAnimationFrame(render);
            } else {
                this.confettiCtx.clearRect(0, 0, this.confettiCanvas.width, this.confettiCanvas.height);
            }
        };

        if (this.confettiAnimId) cancelAnimationFrame(this.confettiAnimId);
        this.confettiAnimId = requestAnimationFrame(render);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.ocaApp = new OcaGameApp();
});
