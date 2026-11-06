// ========================================================
// 🦆 EL JUEGO DE LA OCA - CLIENTE INTERACTIVO MONTECARLO
// Tablero Tradicional Ilustrado con Cartas, Rosetas & Cámara Fija
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

        // Cinematic Action Camera: Zooms into moving token, then zooms back out to full board
        this.actionCameraEnabled = true;

        this.camera = {
            x: 0,
            y: 0,
            scale: 1.0, // Full Board Overview default
            isZoomed: false,
            isDragging: false,
            startX: 0,
            startY: 0,
            camStartX: 0,
            camStartY: 0,
            pinchDist: 0,
            pinchScale: 1.0,
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
        this.renderMontecarloBoard();

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
    // 1. BOARD DATA & MONTECARLO VINTAGE RENDERING
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

        // Map coordinates for 1000x920 SVG viewport
        this.boardCoords = this.boardDef.map(tile => {
            const x = (tile.x_pct / 100.0) * 1000;
            const y = (tile.y_pct / 100.0) * 920;
            return { x, y, tile };
        });
    }

    generateFallbackBoard() {
        const tiles = [];
        tiles.push({ number: 0, tile_type: 'normal', name: 'Salida', x_pct: 31.0, y_pct: 91.5 });
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

            tiles.push({ number: i, tile_type: t, name: `Casilla ${i}`, x_pct: 50, y_pct: 50 });
        }
        return tiles;
    }

    renderMontecarloBoard() {
        this.renderCornerRosettes();
        this.renderSalida();
        this.renderSpiralTrack();
        this.renderTilesCards();
        this.renderGranOcaGarden();
        this.renderPlayerTokens();
    }

    // 4 Mexican Folk Rosettes in the corners
    renderCornerRosettes() {
        const group = document.getElementById('svg-corner-rosettes');
        if (!group) return;
        group.innerHTML = '';

        const corners = [
            { x: 55, y: 55 },
            { x: 945, y: 55 },
            { x: 945, y: 865 },
            { x: 55, y: 865 }
        ];

        corners.forEach(({ x, y }) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${x}, ${y})`);
            g.innerHTML = `
                <!-- Outer Gold Petals -->
                <circle r="36" fill="#851e1e" stroke="#d4af37" stroke-width="2.5"/>
                <circle r="30" fill="#2a9d8f" stroke="#fff" stroke-width="1.5"/>
                <circle r="22" fill="#ffd166" stroke="#851e1e" stroke-width="1.5"/>
                <circle r="12" fill="#9e2a2b"/>
                <circle r="5" fill="#ffffff"/>
                <!-- Star Points -->
                <polygon points="0,-28 7,-16 0,-19 -7,-16" fill="#ffffff"/>
                <polygon points="0,28 7,16 0,19 -7,16" fill="#ffffff"/>
                <polygon points="28,0 16,7 19,0 16,-7" fill="#ffffff"/>
                <polygon points="-28,0 -16,7 -19,0 -16,-7" fill="#ffffff"/>
            `;
            group.appendChild(g);
        });
    }

    // Vintage Salida Checkered Starting Post (Casilla 0)
    renderSalida() {
        const group = document.getElementById('svg-salida-group');
        if (!group) return;
        group.innerHTML = '';

        const coord = this.boardCoords[0] || { x: 310, y: 842 };

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);
        g.innerHTML = `
            <!-- Vintage Salida Base Banner -->
            <rect x="-42" y="-24" width="84" height="48" rx="8" fill="#f8edeb" stroke="#851e1e" stroke-width="2.5" filter="url(#cardShadow)"/>
            <rect x="-38" y="-20" width="76" height="40" rx="6" fill="none" stroke="#d4af37" stroke-width="1.5"/>
            <text x="0" y="-3" text-anchor="middle" font-size="18">🏁</text>
            <text x="0" y="14" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="10.5" fill="#851e1e" letter-spacing="1">SALIDA</text>
        `;
        group.appendChild(g);
    }

    // Golden winding trail connecting all tiles 0..=63 into a continuous spiral ribbon
    renderSpiralTrack() {
        const group = document.getElementById('svg-spiral-track');
        if (!group || this.boardCoords.length === 0) return;
        group.innerHTML = '';

        let pathD = '';
        for (let i = 0; i <= 63; i++) {
            const coord = this.boardCoords[i];
            if (!coord) continue;
            pathD += (pathD === '' ? `M ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}` : ` L ${coord.x.toFixed(1)} ${coord.y.toFixed(1)}`);
        }

        const pathBase = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathBase.setAttribute('d', pathD);
        pathBase.setAttribute('fill', 'none');
        pathBase.setAttribute('stroke', '#f8edeb');
        pathBase.setAttribute('stroke-width', '54');
        pathBase.setAttribute('stroke-linecap', 'round');
        pathBase.setAttribute('stroke-linejoin', 'round');
        pathBase.setAttribute('opacity', '0.75');

        const pathBorder = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathBorder.setAttribute('d', pathD);
        pathBorder.setAttribute('fill', 'none');
        pathBorder.setAttribute('stroke', '#d4af37');
        pathBorder.setAttribute('stroke-width', '50');
        pathBorder.setAttribute('stroke-linecap', 'round');
        pathBorder.setAttribute('stroke-linejoin', 'round');
        pathBorder.setAttribute('opacity', '0.4');

        const pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathLine.setAttribute('d', pathD);
        pathLine.setAttribute('fill', 'none');
        pathLine.setAttribute('stroke', '#851e1e');
        pathLine.setAttribute('stroke-width', '2.5');
        pathLine.setAttribute('stroke-dasharray', '8 6');
        pathLine.setAttribute('stroke-opacity', '0.5');
        pathLine.setAttribute('stroke-linecap', 'round');

        group.appendChild(pathBase);
        group.appendChild(pathBorder);
        group.appendChild(pathLine);
    }

    // Render Every Card-Tile (1 to 62)
    renderTilesCards() {
        const group = document.getElementById('svg-tiles-group');
        if (!group || this.boardCoords.length === 0) return;
        group.innerHTML = '';

        // Alternating Pastel Cardstock Palette (Vintage Montecarlo)
        const palette = ['#caf0f8', '#fefae0', '#d8f3dc', '#ffe5d9', '#e0fbfc', '#fff3b0'];
        const cardW = 50;
        const cardH = 56;

        for (let i = 1; i <= 62; i++) {
            const coord = this.boardCoords[i];
            if (!coord) continue;

            const tile = coord.tile;
            const bgColor = this.getTileBgColor(i, tile.tile_type, palette);

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `svg-tile-item tile-${tile.tile_type}`);
            g.setAttribute('id', `tile-card-${i}`);
            g.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);

            // Detailed Drawing / Motif
            const drawing = this.getCardIllustration(i, tile.tile_type);

            g.innerHTML = `
                <!-- Card Container -->
                <rect class="svg-card-rect" id="rect-card-${i}" x="${-cardW/2}" y="${-cardH/2}" width="${cardW}" height="${cardH}" rx="7" fill="${bgColor}" stroke="rgba(133,30,30,0.35)" stroke-width="1.2" filter="url(#cardShadow)"/>
                <rect x="${-cardW/2 + 2}" y="${-cardH/2 + 2}" width="${cardW - 4}" height="${cardH - 4}" rx="5" fill="none" stroke="rgba(212,175,55,0.4)" stroke-width="0.8"/>

                <!-- Vintage Number Badge -->
                <circle cx="${-cardW/2 + 10}" cy="${-cardH/2 + 10}" r="7.5" fill="#ffffff" stroke="#851e1e" stroke-width="1.2"/>
                <text class="svg-card-num-text" x="${-cardW/2 + 10}" y="${-cardH/2 + 13}" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="900" font-size="8.5" fill="#851e1e">${i}</text>

                <!-- Corner Star Accent -->
                <text x="${cardW/2 - 9}" y="${-cardH/2 + 11}" font-size="8.5" fill="#d90429" text-anchor="middle">★</text>

                <!-- Illustrated Scene -->
                <g>
                    ${drawing}
                </g>
            `;

            group.appendChild(g);
        }
    }

    // Casilla 63: Gran Jardín de la Oca (Center of Spiral)
    renderGranOcaGarden() {
        const group = document.getElementById('svg-garden-group');
        if (!group) return;
        group.innerHTML = '';

        const coord = this.boardCoords[63] || { x: 500, y: 460 };

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', 'tile-card-63');
        g.setAttribute('class', 'svg-tile-item tile-meta');
        g.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);

        let rays = '';
        for (let i = 0; i < 20; i++) {
            const ang = (i * 18) * Math.PI / 180;
            const x1 = Math.cos(ang) * 44;
            const y1 = Math.sin(ang) * 44;
            const x2 = Math.cos(ang) * 64;
            const y2 = Math.sin(ang) * 64;
            rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#d4af37" stroke-width="2" stroke-linecap="round"/>`;
        }

        g.innerHTML = `
            <!-- Radiating Sunburst Rays -->
            <g opacity="0.45">
                ${rays}
            </g>

            <!-- Grand Central Altar / Medallion -->
            <circle class="svg-card-rect" id="rect-card-63" r="66" fill="#fff9db" stroke="#851e1e" stroke-width="3.5" filter="url(#cardShadow)"/>
            <circle r="60" fill="none" stroke="#d4af37" stroke-width="2.5"/>
            <circle r="56" fill="#fefae0" stroke="rgba(133,30,30,0.2)" stroke-width="1"/>
            <circle r="44" fill="#2a9d8f" opacity="0.12"/>

            <!-- Crowned Golden Goose -->
            <g transform="translate(0, -6)">
                <text x="0" y="-12" text-anchor="middle" font-size="18">👑</text>
                <text x="0" y="18" text-anchor="middle" font-size="34">🪿</text>
            </g>

            <!-- Casilla 63 Badge -->
            <circle cx="0" cy="-38" r="14" fill="#d90429" stroke="#ffffff" stroke-width="2"/>
            <text x="0" y="-33.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="13" fill="#ffffff">63</text>

            <!-- ¡VICTORIA! Ribbon at bottom -->
            <rect x="-45" y="32" width="90" height="18" rx="6" fill="#851e1e" stroke="#d4af37" stroke-width="1.2"/>
            <text x="0" y="44.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="10" fill="#ffd166" letter-spacing="1">¡VICTORIA!</text>

            <text x="0" y="58" text-anchor="middle" font-family="'Playfair Display', serif" font-style="italic" font-weight="700" font-size="7.5" fill="#851e1e">
                Gran Jardín de la Oca
            </text>
        `;

        group.appendChild(g);
    }

    // Helper: Card dimensions based on loop
    getCardWidth(num) {
        return 50;
    }

    getCardHeight(num) {
        return 56;
    }

    getTileBgColor(num, type, palette) {
        if (type === 'oca') return '#d8f3dc'; // Green pasture / water
        if (type === 'puente') return '#caf0f8'; // River blue
        if (type === 'dados') return '#f3e8ff'; // Violet dice
        if (type === 'posada') return '#ffe5d9'; // Peach inn
        if (type === 'pozo') return '#e2ece9'; // Stone well
        if (type === 'laberinto') return '#d7e3fc'; // Maze cyan
        if (type === 'carcel') return '#ede9fe'; // Prison slate
        if (type === 'muerte') return '#ffe3e3'; // Skull coral
        return palette[num % palette.length];
    }

    // Distinct illustrated scene for EVERY card matching classic Montecarlo board
    getCardIllustration(num, type) {
        // Special Tiles
        if (type === 'oca') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="20">🦆</text>
                <rect x="-21" y="15" width="42" height="10" rx="3" fill="#2a9d8f" stroke="#1b4332" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7" fill="#ffffff">★ OCA ★</text>
            `;
        }
        if (type === 'puente') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="20">🌉</text>
                <rect x="-22" y="15" width="44" height="10" rx="3" fill="#0077b6" stroke="#03045e" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7" fill="#ffffff">PUENTE</text>
            `;
        }
        if (type === 'dados') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="19">🎲</text>
                <rect x="-21" y="15" width="42" height="10" rx="3" fill="#7209b7" stroke="#3a0ca3" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7" fill="#ffffff">DADOS</text>
            `;
        }
        if (type === 'posada') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="19">🏨</text>
                <rect x="-21" y="15" width="42" height="10" rx="3" fill="#e76f51" stroke="#9d0208" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="6.8" fill="#ffffff">POSADA</text>
            `;
        }
        if (type === 'pozo') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="19">🕳️</text>
                <rect x="-20" y="15" width="40" height="10" rx="3" fill="#52796f" stroke="#2f3e46" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7" fill="#ffffff">POZO</text>
            `;
        }
        if (type === 'laberinto') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="19">🌀</text>
                <rect x="-23" y="15" width="46" height="10" rx="3" fill="#023e8a" stroke="#03045e" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="6.5" fill="#ffffff">LABERINTO</text>
            `;
        }
        if (type === 'carcel') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="19">⛓️</text>
                <rect x="-21" y="15" width="42" height="10" rx="3" fill="#4a4e69" stroke="#22223b" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7" fill="#ffffff">CÁRCEL</text>
            `;
        }
        if (type === 'muerte') {
            return `
                <text x="0" y="7" text-anchor="middle" font-size="20">💀</text>
                <rect x="-22" y="15" width="44" height="10" rx="3" fill="#c1121f" stroke="#780000" stroke-width="0.8"/>
                <text x="0" y="22.5" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7" fill="#ffffff">MUERTE</text>
            `;
        }

        // Classic Montecarlo Board Motifs with labels
        const motifs = {
            1: { icon: '⛲', label: 'FUENTE' },
            2: { icon: '🍇', label: 'FRUTAS' },
            3: { icon: '🚶', label: 'PASEO' },
            4: { icon: '🏊', label: 'LAGO' },
            7: { icon: '🔨', label: 'FORJA' },
            8: { icon: '🤠', label: 'CHARRO' },
            10: { icon: '🎨', label: 'PINTOR' },
            11: { icon: '🎸', label: 'MARIACHI' },
            13: { icon: '🚂', label: 'TREN' },
            15: { icon: '🎹', label: 'PIANO' },
            16: { icon: '💃', label: 'JARABE' },
            17: { icon: '🛶', label: 'TRAJINERA' },
            20: { icon: '🐂', label: 'TORO' },
            21: { icon: '🎭', label: 'TEATRO' },
            22: { icon: '🐎', label: 'CORCEL' },
            24: { icon: '👨‍🍳', label: 'FESTÍN' },
            25: { icon: '🏰', label: 'CASTILLO' },
            28: { icon: '🏛️', label: 'PIRÁMIDE' },
            29: { icon: '⛺', label: 'SIERRA' },
            30: { icon: '🌴', label: 'PALMAR' },
            33: { icon: '🎣', label: 'PESCA' },
            34: { icon: '🏃', label: 'ATLETA' },
            35: { icon: '🤸', label: 'ACRÓBATA' },
            37: { icon: '🏇', label: 'JINETE' },
            38: { icon: '🛸', label: 'DIRIGIBLE' },
            39: { icon: '🥊', label: 'BOXEO' },
            40: { icon: '🐃', label: 'RANCHO' },
            43: { icon: '⛵', label: 'VELERO' },
            44: { icon: '🎈', label: 'GLOBO' },
            46: { icon: '⛷️', label: 'NIEVE' },
            47: { icon: '🏊‍♂️', label: 'CLAVADOS' },
            48: { icon: '🎪', label: 'CIRCO' },
            49: { icon: '⛹️', label: 'CANCHA' },
            51: { icon: '⚒️', label: 'MINERO' },
            55: { icon: '🏝️', label: 'ISLA' },
            56: { icon: '🛩️', label: 'AVIONETA' },
            57: { icon: '🚢', label: 'VAPOR' },
            60: { icon: '🤼', label: 'LUCHA' },
            61: { icon: '🚴', label: 'CICLISMO' },
            62: { icon: '⚾', label: 'BÉISBOL' },
        };

        const item = motifs[num] || { icon: '⭐', label: `PASO ${num}` };
        return `
            <circle cx="0" cy="3" r="14" fill="#ffffff" stroke="#d4af37" stroke-width="1" opacity="0.95"/>
            <text x="0" y="8" text-anchor="middle" font-size="16">${item.icon}</text>
            <text x="0" y="22" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="800" font-size="6.8" fill="#4a3525" letter-spacing="0.3">${item.label}</text>
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
                    const radius = 16;
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
    // 2. CAMERA ENGINE: FIXED & STEADY (NO AGGRESSIVE JITTER)
    // ========================================================
    setupCameraGestures() {
        const viewport = document.getElementById('board-viewport');
        const cameraEl = document.getElementById('board-camera');
        if (!viewport || !cameraEl) return;

        let isDown = false;

        // Manual drag when user explicitly wants to explore
        viewport.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.board-camera-controls')) return;
            if (!this.camera.isZoomed) return; // In fixed view, no drag needed

            isDown = true;
            this.camera.isDragging = true;
            cameraEl.classList.remove('camera-smooth');
            this.camera.startX = e.clientX;
            this.camera.startY = e.clientY;
            this.camera.camStartX = this.camera.x;
            this.camera.camStartY = this.camera.y;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDown || !this.camera.isZoomed) return;
            const dx = e.clientX - this.camera.startX;
            const dy = e.clientY - this.camera.startY;
            this.camera.x = this.camera.camStartX + dx;
            this.camera.y = this.camera.camStartY + dy;
            this.applyCameraTransform(false);
        });

        window.addEventListener('pointerup', () => {
            isDown = false;
            this.camera.isDragging = false;
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
                    this.camera.scale = Math.min(Math.max(this.camera.pinchScale * ratio, 1.0), 2.5);
                    this.camera.isZoomed = (this.camera.scale > 1.08);
                    this.updateCameraPillText();
                    this.applyCameraTransform(false);
                }
            }
        }, { passive: true });

        // Camera Buttons
        const btnAuto = document.getElementById('btn-camera-auto');
        if (btnAuto) {
            btnAuto.addEventListener('click', () => {
                this.actionCameraEnabled = !this.actionCameraEnabled;
                btnAuto.classList.toggle('active', this.actionCameraEnabled);
                const txt = document.getElementById('cam-auto-text');
                if (txt) {
                    txt.textContent = this.actionCameraEnabled ? 'Acción: ON' : 'Acción: OFF';
                }
            });
        }

        const btnToggle = document.getElementById('btn-camera-toggle');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => this.toggleCameraZoom());
        }

        const btnCenterMe = document.getElementById('btn-camera-center-me');
        if (btnCenterMe) {
            btnCenterMe.addEventListener('click', () => this.centerOnMyToken());
        }

        const btnZoomIn = document.getElementById('btn-zoom-in');
        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                this.camera.scale = Math.min(this.camera.scale + 0.3, 2.6);
                this.camera.isZoomed = true;
                this.updateCameraPillText();
                this.applyCameraTransform(true);
            });
        }

        const btnZoomOut = document.getElementById('btn-zoom-out');
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                this.camera.scale = Math.max(this.camera.scale - 0.3, 1.0);
                if (this.camera.scale <= 1.05) {
                    this.resetCameraToFullView();
                } else {
                    this.applyCameraTransform(true);
                }
            });
        }

        const btnZoomReset = document.getElementById('btn-zoom-reset');
        if (btnZoomReset) {
            btnZoomReset.addEventListener('click', () => this.resetCameraToFullView());
        }
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
            const isMobile = window.innerWidth <= 768;
            this.camera.scale = isMobile ? 1.85 : 1.6;
            this.centerOnMyToken();
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
            text.textContent = 'Zoom';
        } else {
            pill.classList.remove('active');
            text.textContent = 'Completo';
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

    // Soft single-glide only after moves, avoiding jitter or dizziness
    softGlideToTile(tileNum) {
        if (!this.camera.isZoomed) return;

        const viewport = document.getElementById('board-viewport');
        if (!viewport || this.boardCoords.length === 0) return;

        const coords = this.boardCoords[tileNum] || this.boardCoords[1] || { x: 500, y: 410 };
        const vW = viewport.clientWidth;
        const vH = viewport.clientHeight;
        if (vW === 0 || vH === 0) return;

        const scaleX = vW / 1000;
        const scaleY = vH / 920;
        const baseScale = Math.min(scaleX, scaleY);

        const renderedSvgW = 1000 * baseScale;
        const renderedSvgH = 920 * baseScale;
        const svgOffsetX = (vW - renderedSvgW) / 2;
        const svgOffsetY = (vH - renderedSvgH) / 2;

        const tileX = svgOffsetX + (coords.x * baseScale);
        const tileY = svgOffsetY + (coords.y * baseScale);

        this.camera.x = (vW / 2) - (tileX * this.camera.scale);
        this.camera.y = (vH / 2) - (tileY * this.camera.scale);
        this.applyCameraTransform(true);
    }

    centerOnMyToken() {
        if (!this.room || !this.myId) return;
        const me = this.room.players.find(p => p.id === this.myId);
        const targetPos = me ? me.position : 1;
        const isMobile = window.innerWidth <= 768;
        this.camera.scale = isMobile ? 1.85 : 1.6;
        this.camera.isZoomed = true;
        this.updateCameraPillText();
        this.softGlideToTile(targetPos);
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
                if (this.camera.isZoomed) {
                    this.softGlideToTile(p.position);
                }
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
    // 5. GAME FLOW & CINEMATIC ACTION CAMERA
    // ========================================================
    async handleTurnEvent(event) {
        this.isAnimating = true;
        const rollBtn = document.getElementById('btn-roll-dice');
        if (rollBtn) rollBtn.disabled = true;

        const path = event.path || [];
        const startPos = path.length > 0 ? path[0] : event.final_pos;
        const isMyTurn = (event.player_id === this.myId);

        // 1. ACTION CAMERA: Smoothly Zoom IN ONLY when it's MY turn!
        // When bots play, keep camera calm and steady in full view.
        if (this.actionCameraEnabled && isMyTurn) {
            const isMobile = window.innerWidth <= 768;
            this.camera.scale = isMobile ? 1.85 : 1.5;
            this.camera.isZoomed = true;
            this.updateCameraPillText();
            this.softGlideToTile(startPos);
        }

        // 2. Animate 3D Dice Roll
        this.animateDiceRoll(event.dice, event.total);
        if (window.ocaAudio) window.ocaAudio.playDiceRoll();

        await this.sleep(700);

        // 3. Token hops step by step - clear and large in zoomed view!
        if (path.length > 0) {
            for (let i = 0; i < path.length; i++) {
                const stepPos = path[i];
                this.moveTokenTo(event.player_id, stepPos);
                this.highlightCard(stepPos);

                if (window.ocaAudio) window.ocaAudio.playStep();

                // Gentle midway catch-up ONLY if it's my turn
                if (this.actionCameraEnabled && isMyTurn && path.length > 5 && i === Math.floor(path.length / 2)) {
                    this.softGlideToTile(stepPos);
                }

                await this.sleep(220);
            }
        }

        // 4. Focus on landed tile
        this.highlightCard(event.final_pos);
        if ((this.actionCameraEnabled && isMyTurn) || this.camera.isZoomed) {
            this.softGlideToTile(event.final_pos);
        }

        // 5. Special Tile Triggers & Rhymes
        if (event.rhyme) {
            this.showRhymeBanner(event.tile_type, event.rhyme);
        }

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

        // 6. Log & Radar update
        this.addLogEntry(event);
        this.updateRaceRadar();

        // 7. Handle Win
        if (event.is_win) {
            this.showVictoryModal(event.player_name);
            this.startConfetti();
        }

        // 8. PAUSE to let the user admire the landed card and read the rhyme!
        await this.sleep(1350);

        // 9. ACTION CAMERA: Smoothly Zoom OUT to full board overview after my turn!
        if (this.actionCameraEnabled && isMyTurn && !event.is_win) {
            this.resetCameraToFullView();
            await this.sleep(600);
        }

        this.isAnimating = false;
        this.updateTurnControls();
    }

    highlightCard(tileNum) {
        document.querySelectorAll('.svg-card-rect').forEach(r => r.classList.remove('active-tile'));
        const activeRect = document.getElementById(`rect-card-${tileNum}`);
        if (activeRect) {
            activeRect.classList.add('active-tile');
        }
    }

    animateDiceRoll(dice, total) {
        const c1 = document.getElementById('cube-die-1');
        const c2 = document.getElementById('cube-die-2');
        const totalDisplay = document.getElementById('dice-total-num');

        if (c1) c1.classList.add('rolling');
        if (c2 && dice.length > 1 && dice[1] > 0) {
            c2.style.display = 'block';
            c2.classList.add('rolling');
        } else if (c2 && (dice.length <= 1 || dice[1] === 0)) {
            c2.style.display = 'none';
        }

        setTimeout(() => {
            if (c1) {
                c1.classList.remove('rolling');
                this.setDiceRotation(c1, dice[0] || 1);
            }
            if (c2 && dice.length > 1 && dice[1] > 0) {
                c2.classList.remove('rolling');
                this.setDiceRotation(c2, dice[1] || 1);
            }
            if (totalDisplay) {
                totalDisplay.textContent = total;
            }
        }, 550);
    }

    setDiceRotation(cubeEl, value) {
        const rotations = {
            1: "rotateX(0deg) rotateY(0deg)",
            2: "rotateX(0deg) rotateY(180deg)",
            3: "rotateX(0deg) rotateY(90deg)",
            4: "rotateX(0deg) rotateY(-90deg)",
            5: "rotateX(-90deg) rotateY(0deg)",
            6: "rotateX(90deg) rotateY(0deg)"
        };
        cubeEl.style.transform = rotations[value] || rotations[1];
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

                item.addEventListener('click', () => {
                    this.highlightCard(p.position);
                    if (this.camera.isZoomed) {
                        this.softGlideToTile(p.position);
                    }
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

        const diceStage = document.getElementById('dice-container-box');
        if (diceStage) {
            diceStage.addEventListener('click', () => {
                const rollBtn = document.getElementById('btn-roll-dice');
                if (rollBtn && !rollBtn.disabled) {
                    rollBtn.click();
                }
            });
        }

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
