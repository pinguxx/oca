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
        this.playerPositions = {};

        // Customization
        this.selectedAvatar = '🪿';
        this.selectedColor = '#e63946';

        // Cinematic Action Follow Camera: Smoothly tracks active player/bot turn
        this.followAction = true;
        this.activeMovingPlayerId = null;

        // Sequential Turn Queue (prevents race conditions between human and bots)
        this.turnQueue = [];
        this.isProcessingQueue = false;

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

        // Restore stored player name if available
        const stored = this.getStoredSession();
        if (stored && stored.playerName) {
            const nameInput = document.getElementById('player-name-input');
            if (nameInput) nameInput.value = stored.playerName;
        }

        // Initialize dice in settled state without seam artifacts
        const c1 = document.getElementById('cube-die-1');
        const c2 = document.getElementById('cube-die-2');
        if (c1) this.markDiceSettled(c1, 1);
        if (c2) this.markDiceSettled(c2, 1);

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

        // Map coordinates for 1000x900 SVG viewport
        this.boardCoords = this.boardDef.map(tile => {
            const x = (tile.x_pct / 100.0) * 1000;
            const y = (tile.y_pct / 100.0) * 900;
            return { x, y, tile };
        });
    }

    generateFallbackBoard() {
        const tiles = [];
        tiles.push({ number: 0, tile_type: 'normal', name: 'Salida', x_pct: 6.5, y_pct: 92.8 });
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
        this.renderCenterCourtArt();
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
            { x: 50, y: 50 },
            { x: 950, y: 50 },
            { x: 950, y: 850 },
            { x: 50, y: 850 }
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

        const coord = this.boardCoords[0] || { x: 65, y: 835 };

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);
        g.innerHTML = `
            <!-- Vintage Salida Card Base -->
            <rect class="svg-card-rect" id="rect-card-0" x="-34" y="-36" width="68" height="72" rx="7" fill="#f8edeb" stroke="#851e1e" stroke-width="2.5" filter="url(#cardShadow)"/>
            <rect x="-31.5" y="-33.5" width="63" height="67" rx="5" fill="none" stroke="#d4af37" stroke-width="1.5"/>

            <!-- Centered Number Badge 0 -->
            <circle cx="-20" cy="-21" r="12" fill="#ffffff" stroke="#851e1e" stroke-width="1.8"/>
            <text class="svg-card-num-text" x="-20" y="-21">0</text>

            <!-- Checkered Flag and Label -->
            <text x="0" y="5" text-anchor="middle" font-size="24">🏁</text>
            <rect x="-26" y="16" width="52" height="13" rx="3" fill="#851e1e"/>
            <text x="0" y="25" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="7.5" fill="#ffd166" letter-spacing="1">SALIDA</text>
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
        pathBase.setAttribute('stroke-width', '68');
        pathBase.setAttribute('stroke-linecap', 'round');
        pathBase.setAttribute('stroke-linejoin', 'round');
        pathBase.setAttribute('opacity', '0.6');

        const pathBorder = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathBorder.setAttribute('d', pathD);
        pathBorder.setAttribute('fill', 'none');
        pathBorder.setAttribute('stroke', '#d4af37');
        pathBorder.setAttribute('stroke-width', '64');
        pathBorder.setAttribute('stroke-linecap', 'round');
        pathBorder.setAttribute('stroke-linejoin', 'round');
        pathBorder.setAttribute('opacity', '0.35');

        const pathLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathLine.setAttribute('d', pathD);
        pathLine.setAttribute('fill', 'none');
        pathLine.setAttribute('stroke', '#851e1e');
        pathLine.setAttribute('stroke-width', '2.5');
        pathLine.setAttribute('stroke-dasharray', '8 6');
        pathLine.setAttribute('stroke-opacity', '0.45');
        pathLine.setAttribute('stroke-linecap', 'round');

        group.appendChild(pathBase);
        group.appendChild(pathBorder);
        group.appendChild(pathLine);
    }

    // Majestic Vintage Center Court Medallion (Center of Board)
    renderCenterCourtArt() {
        const group = document.getElementById('svg-center-court');
        if (!group) return;
        group.innerHTML = '';

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('transform', 'translate(390, 390)');

        let rays = '';
        for (let i = 0; i < 24; i++) {
            const ang = (i * 15) * Math.PI / 180;
            const x1 = Math.cos(ang) * 20;
            const y1 = Math.sin(ang) * 20;
            const x2 = Math.cos(ang) * 95;
            const y2 = Math.sin(ang) * 95;
            rays += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#851e1e" stroke-width="1.8" stroke-dasharray="4 4" />`;
        }

        g.innerHTML = `
            <!-- Vintage Card Base (240x240) -->
            <rect x="-120" y="-120" width="240" height="240" rx="14" fill="#fffef7" stroke="#851e1e" stroke-width="3" filter="url(#cardShadow)"/>
            <rect x="-114" y="-114" width="228" height="228" rx="10" fill="none" stroke="#d4af37" stroke-width="2"/>
            <rect x="-110" y="-110" width="220" height="220" rx="8" fill="none" stroke="rgba(133,30,30,0.18)" stroke-width="1"/>

            <!-- Radiant Sunburst Pattern -->
            <g opacity="0.22">
                ${rays}
            </g>

            <!-- Rosette / Compass Rose Centerpiece -->
            <circle cx="0" cy="5" r="46" fill="#fff9db" stroke="#851e1e" stroke-width="2.5"/>
            <circle cx="0" cy="5" r="38" fill="#2a9d8f" stroke="#d4af37" stroke-width="1.5" opacity="0.85"/>
            <circle cx="0" cy="5" r="26" fill="#851e1e"/>
            <circle cx="0" cy="5" r="7" fill="#ffd166"/>

            <!-- 8-Pointed Star (Rosa de los Vientos) -->
            <polygon points="0,-28 6,3 0,8 -6,3" fill="#ffffff" transform="translate(0, 5)"/>
            <polygon points="0,38 6,12 0,5 -6,12" fill="#ffffff" transform="translate(0, 5)"/>
            <polygon points="33,5 6,10 0,5 6,0" fill="#ffffff" transform="translate(0, 5)"/>
            <polygon points="-33,5 -6,10 0,5 -6,0" fill="#ffffff" transform="translate(0, 5)"/>

            <text x="0" y="10" text-anchor="middle" font-size="16">🪿</text>

            <!-- Header Curved Ribbon: EL JUEGO DE LA OCA -->
            <path d="M -105,-82 Q 0,-102 105,-82 L 100,-58 Q 0,-76 -100,-58 Z" fill="#ffd166" stroke="#851e1e" stroke-width="2" filter="url(#cardShadow)"/>
            <text x="0" y="-68" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-weight="900" font-size="13" fill="#851e1e" letter-spacing="1">EL JUEGO DE LA OCA</text>

            <!-- Subtitle Ribbon -->
            <rect x="-75" y="-52" width="150" height="17" rx="8" fill="#851e1e"/>
            <text x="0" y="-40" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="700" font-size="8.5" fill="#ffd166" letter-spacing="1">EDICIÓN TRADICIONAL</text>

            <!-- Motto Banner at Bottom -->
            <path d="M -110,82 Q 0,70 110,82 L 105,106 Q 0,94 -105,106 Z" fill="#f8edeb" stroke="#851e1e" stroke-width="1.5"/>
            <text x="0" y="97" text-anchor="middle" font-family="'Playfair Display', Georgia, serif" font-style="italic" font-weight="700" font-size="9.5" fill="#851e1e">
                «De oca a oca y tiro porque me toca»
            </text>

            <!-- Corner Stars -->
            <text x="-106" y="-98" font-size="12" fill="#d90429">★</text>
            <text x="96" y="-98" font-size="12" fill="#d90429">★</text>
            <text x="-106" y="112" font-size="12" fill="#d90429">★</text>
            <text x="96" y="112" font-size="12" fill="#d90429">★</text>
        `;

        group.appendChild(g);
    }

    // Render Every Card-Tile (1 to 62)
    renderTilesCards() {
        const group = document.getElementById('svg-tiles-group');
        if (!group || this.boardCoords.length === 0) return;
        group.innerHTML = '';

        // Alternating Pastel Cardstock Palette (Vintage Montecarlo)
        const palette = ['#caf0f8', '#fefae0', '#d8f3dc', '#ffe5d9', '#e0fbfc', '#fff3b0'];
        const cardW = 68;
        const cardH = 72;

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
                <!-- Card Container (68x72) -->
                <rect class="svg-card-rect" id="rect-card-${i}" x="-34" y="-36" width="68" height="72" rx="7" fill="${bgColor}" stroke="rgba(133,30,30,0.35)" stroke-width="1.2" filter="url(#cardShadow)"/>
                <rect x="-31.5" y="-33.5" width="63" height="67" rx="5" fill="none" stroke="rgba(212,175,55,0.4)" stroke-width="0.8"/>

                <!-- Vintage Number Badge (Prominent, High Contrast & Centered) -->
                <circle cx="-20" cy="-21" r="12" fill="#ffffff" stroke="#851e1e" stroke-width="1.8"/>
                <text class="svg-card-num-text" x="-20" y="-21">${i}</text>

                <!-- Corner Star Accent -->
                <text x="21" y="-20" font-size="11" fill="#d90429" text-anchor="middle">★</text>

                <!-- Illustrated Scene -->
                <g>
                    ${drawing}
                </g>
            `;

            group.appendChild(g);
        }
    }

    // Casilla 63: Gran Jardín de la Oca (Center Court Destination)
    renderGranOcaGarden() {
        const group = document.getElementById('svg-garden-group');
        if (!group) return;
        group.innerHTML = '';

        const coord = this.boardCoords[63] || { x: 610, y: 390 };

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('id', 'tile-card-63');
        g.setAttribute('class', 'svg-tile-item tile-meta');
        g.setAttribute('transform', `translate(${coord.x}, ${coord.y})`);

        g.innerHTML = `
            <!-- Golden Card Base (160x240) -->
            <rect class="svg-card-rect" id="rect-card-63" x="-80" y="-120" width="160" height="240" rx="14" fill="#fff9db" stroke="#851e1e" stroke-width="3" filter="url(#cardShadow)"/>
            <rect x="-74" y="-114" width="148" height="228" rx="10" fill="none" stroke="#d4af37" stroke-width="2"/>
            <rect x="-70" y="-110" width="140" height="220" rx="8" fill="none" stroke="rgba(133,30,30,0.18)" stroke-width="1"/>

            <!-- Curving Ribbon: 'Juego de la Oca' -->
            <path d="M -65,-86 Q 0,-102 65,-86 L 62,-66 Q 0,-80 -62,-66 Z" fill="#ffd166" stroke="#851e1e" stroke-width="1.8"/>
            <text x="0" y="-74" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="12.5" fill="#851e1e">Juego de la Oca</text>

            <!-- Casilla 63 Number Circle -->
            <circle cx="0" cy="-36" r="18" fill="#d90429" stroke="#ffffff" stroke-width="2.5"/>
            <text x="0" y="-36" text-anchor="middle" dominant-baseline="central" font-family="'Outfit', sans-serif" font-weight="900" font-size="18" fill="#ffffff">63</text>

            <!-- Crowned Royal Goose -->
            <g transform="translate(0, 22)">
                <text x="0" y="-16" text-anchor="middle" font-size="22">👑</text>
                <text x="0" y="22" text-anchor="middle" font-size="52">🪿</text>
            </g>

            <!-- ¡VICTORIA! Ribbon -->
            <rect x="-56" y="82" width="112" height="24" rx="6" fill="#851e1e" stroke="#d4af37" stroke-width="1.2"/>
            <text x="0" y="98" text-anchor="middle" font-family="'Playfair Display', serif" font-weight="900" font-size="12" fill="#ffd166" letter-spacing="1">¡VICTORIA!</text>
        `;

        group.appendChild(g);
    }

    // Helper: Card dimensions based on loop
    getCardWidth(num) {
        return 68;
    }

    getCardHeight(num) {
        return 72;
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
                <text x="0" y="8" text-anchor="middle" font-size="24">🦆</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#2a9d8f" stroke="#1b4332" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.8" fill="#ffffff" letter-spacing="0.5">★ OCA ★</text>
            `;
        }
        if (type === 'puente') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="24">🌉</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#0077b6" stroke="#03045e" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.8" fill="#ffffff" letter-spacing="0.5">PUENTE</text>
            `;
        }
        if (type === 'dados') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="23">🎲</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#7209b7" stroke="#3a0ca3" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.8" fill="#ffffff" letter-spacing="0.5">DADOS</text>
            `;
        }
        if (type === 'posada') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="23">🏨</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#e76f51" stroke="#9d0208" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.5" fill="#ffffff" letter-spacing="0.5">POSADA</text>
            `;
        }
        if (type === 'pozo') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="23">🕳️</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#52796f" stroke="#2f3e46" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.8" fill="#ffffff" letter-spacing="0.5">POZO</text>
            `;
        }
        if (type === 'laberinto') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="23">🌀</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#023e8a" stroke="#03045e" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.2" fill="#ffffff" letter-spacing="0.3">LABERINTO</text>
            `;
        }
        if (type === 'carcel') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="23">⛓️</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#4a4e69" stroke="#22223b" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.8" fill="#ffffff" letter-spacing="0.5">CÁRCEL</text>
            `;
        }
        if (type === 'muerte') {
            return `
                <text x="0" y="8" text-anchor="middle" font-size="24">💀</text>
                <rect x="-25" y="16" width="50" height="13" rx="3.5" fill="#c1121f" stroke="#780000" stroke-width="1"/>
                <text x="0" y="25.5" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.8" fill="#ffffff" letter-spacing="0.5">MUERTE</text>
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
            <circle cx="0" cy="2" r="16" fill="#ffffff" stroke="#d4af37" stroke-width="1.2" opacity="0.95"/>
            <text x="0" y="8.5" text-anchor="middle" font-size="20">${item.icon}</text>
            <rect x="-25" y="16" width="50" height="12" rx="3.5" fill="#ffffff" stroke="#d4af37" stroke-width="0.8"/>
            <text x="0" y="25" text-anchor="middle" font-family="'Outfit', sans-serif" font-weight="900" font-size="8.5" fill="#3a2212" letter-spacing="0.4">${item.label}</text>
        `;
    }

    ensureTokenElement(player) {
        let tokenEl = document.getElementById(`token-group-${player.id}`);
        if (!tokenEl) {
            const tokensGroup = document.getElementById('svg-tokens-group');
            if (!tokensGroup) return null;

            tokenEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            tokenEl.setAttribute('id', `token-group-${player.id}`);
            tokenEl.setAttribute('class', 'token-group');
            tokenEl.innerHTML = `
                <circle class="token-circle" r="20" fill="${player.color}"/>
                <circle r="17.5" fill="none" stroke="rgba(255,255,255,0.75)" stroke-width="1.8"/>
                <text class="token-avatar" y="0">${player.avatar}</text>
            `;
            const pos = this.playerPositions[player.id] ?? player.position ?? 0;
            const coords = this.boardCoords[pos] || this.boardCoords[0];
            tokenEl.setAttribute('transform', `translate(${coords.x}, ${coords.y})`);
            tokensGroup.appendChild(tokenEl);
        }
        return tokenEl;
    }

    renderPlayerTokens() {
        const tokensGroup = document.getElementById('svg-tokens-group');
        if (!tokensGroup || !this.room) return;

        // Ensure all active players have persistent tokens in DOM
        this.room.players.forEach(p => {
            this.ensureTokenElement(p);
        });

        // Group players by current position to compute multi-player offsets
        const posMap = {};
        this.room.players.forEach(p => {
            if (this.activeMovingPlayerId !== p.id) {
                this.playerPositions[p.id] = p.position;
            }
            const pos = this.playerPositions[p.id] ?? p.position ?? 0;
            if (!posMap[pos]) posMap[pos] = [];
            posMap[pos].push(p);
        });

        Object.entries(posMap).forEach(([posStr, playersOnTile]) => {
            const pos = parseInt(posStr, 10);
            const coords = this.boardCoords[pos] || this.boardCoords[0];
            const totalOnTile = playersOnTile.length;

            playersOnTile.forEach((player, idx) => {
                // If this token is currently hopping in active animation, do not override its transform!
                if (this.activeMovingPlayerId === player.id) return;

                let offsetX = 0;
                let offsetY = 0;
                if (totalOnTile > 1) {
                    const angle = (idx / totalOnTile) * Math.PI * 2;
                    const radius = 18;
                    offsetX = Math.cos(angle) * radius;
                    offsetY = Math.sin(angle) * radius;
                }

                const tokenEl = this.ensureTokenElement(player);
                if (tokenEl) {
                    tokenEl.setAttribute('transform', `translate(${coords.x + offsetX}, ${coords.y + offsetY})`);
                }
            });
        });

        this.updateRaceRadar();
    }

    // ========================================================
    // 2. CAMERA ENGINE: SMOOTH & CONTINUOUS FLOW
    // ========================================================
    setupCameraGestures() {
        const viewport = document.getElementById('board-viewport');
        const cameraEl = document.getElementById('board-camera');
        if (!viewport || !cameraEl) return;

        let isDown = false;

        // Manual drag when user is zoomed in and wants to pan
        viewport.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.board-camera-controls')) return;
            if (!this.camera.isZoomed) return;

            isDown = true;
            this.camera.isDragging = true;
            cameraEl.classList.remove('camera-smooth');
            cameraEl.style.transition = 'none';
            this.camera.startX = e.clientX;
            this.camera.startY = e.clientY;
            this.camera.camStartX = this.camera.x;
            this.camera.camStartY = this.camera.y;
        });

        window.addEventListener('pointermove', (e) => {
            if (!isDown || !this.camera.isZoomed) return;
            const dx = e.clientX - this.camera.startX;
            const dy = e.clientY - this.camera.startY;
            const clamped = this.clampCameraCoords(this.camera.camStartX + dx, this.camera.camStartY + dy);
            this.camera.x = clamped.x;
            this.camera.y = clamped.y;
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
                cameraEl.style.transition = 'none';
            }
        }, { passive: true });

        viewport.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                const t1 = e.touches[0];
                const t2 = e.touches[1];
                const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
                if (this.camera.pinchDist > 0) {
                    const ratio = dist / this.camera.pinchDist;
                    this.camera.scale = Math.min(Math.max(this.camera.pinchScale * ratio, 1.0), 3.2);
                    this.camera.isZoomed = (this.camera.scale > 1.08);
                    this.updateCameraPillText();
                    const clamped = this.clampCameraCoords(this.camera.x, this.camera.y);
                    this.camera.x = clamped.x;
                    this.camera.y = clamped.y;
                    this.applyCameraTransform(false);
                }
            }
        }, { passive: true });

        // Rule 6: Single toggle button to toggle full out zoom or follow chip
        const btnToggle = document.getElementById('btn-camera-toggle');
        if (btnToggle) {
            btnToggle.addEventListener('click', () => this.toggleCameraZoom());
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

    // Camera Clamping: Ensures board tiles ALWAYS fill the screen without leaving empty white margins outside the board edges
    clampCameraCoords(targetX, targetY) {
        const viewport = document.getElementById('board-viewport');
        if (!viewport) return { x: targetX, y: targetY };

        const vW = viewport.clientWidth;
        const vH = viewport.clientHeight;
        if (vW === 0 || vH === 0) return { x: targetX, y: targetY };

        if (!this.camera.isZoomed || this.camera.scale <= 1.02) {
            return { x: 0, y: 0 };
        }

        const scaleX = vW / 1000;
        const scaleY = vH / 900;
        const baseScale = Math.min(scaleX, scaleY);

        const renderedSvgW = 1000 * baseScale;
        const renderedSvgH = 900 * baseScale;
        const svgOffsetX = (vW - renderedSvgW) / 2;
        const svgOffsetY = (vH - renderedSvgH) / 2;

        const minX = vW - ((svgOffsetX + renderedSvgW) * this.camera.scale);
        const maxX = - (svgOffsetX * this.camera.scale);
        const minY = vH - ((svgOffsetY + renderedSvgH) * this.camera.scale);
        const maxY = - (svgOffsetY * this.camera.scale);

        let clampedX = targetX;
        let clampedY = targetY;

        if (minX <= maxX) {
            clampedX = Math.max(minX, Math.min(maxX, targetX));
        } else {
            clampedX = (minX + maxX) / 2;
        }

        if (minY <= maxY) {
            clampedY = Math.max(minY, Math.min(maxY, targetY));
        } else {
            clampedY = (minY + maxY) / 2;
        }

        return { x: clampedX, y: clampedY };
    }

    calculateTargetCameraXY(tileNum) {
        const viewport = document.getElementById('board-viewport');
        if (!viewport || this.boardCoords.length === 0) return;

        const coords = this.boardCoords[tileNum] || this.boardCoords[1] || { x: 500, y: 450 };
        const vW = viewport.clientWidth;
        const vH = viewport.clientHeight;
        if (vW === 0 || vH === 0) return;

        const scaleX = vW / 1000;
        const scaleY = vH / 900;
        const baseScale = Math.min(scaleX, scaleY);

        const renderedSvgW = 1000 * baseScale;
        const renderedSvgH = 900 * baseScale;
        const svgOffsetX = (vW - renderedSvgW) / 2;
        const svgOffsetY = (vH - renderedSvgH) / 2;

        const tileX = svgOffsetX + (coords.x * baseScale);
        const tileY = svgOffsetY + (coords.y * baseScale);

        const rawTargetX = (vW / 2) - (tileX * this.camera.scale);
        const rawTargetY = (vH / 2) - (tileY * this.camera.scale);

        const clamped = this.clampCameraCoords(rawTargetX, rawTargetY);
        this.camera.x = clamped.x;
        this.camera.y = clamped.y;
    }

    // Smooth zoom into a specific token (2.85x on mobile so cards, icons and numbers are huge & crystal clear)
    zoomInToToken(tileNum, duration = 0.85) {
        const isMobile = window.innerWidth <= 768;
        this.camera.scale = isMobile ? 2.85 : 1.85;
        this.camera.isZoomed = true;
        this.updateCameraPillText();
        this.calculateTargetCameraXY(tileNum);

        const cameraEl = document.getElementById('board-camera');
        if (cameraEl) {
            cameraEl.style.transition = `transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1)`;
            cameraEl.classList.add('camera-smooth');
            this.applyCameraTransform(true);
        }
    }

    // Camera slowly and steadily tracks each hop step
    trackStepWithCamera(tileNum, durationSec = 0.24) {
        if (!this.camera.isZoomed) return;
        this.calculateTargetCameraXY(tileNum);

        const cameraEl = document.getElementById('board-camera');
        if (cameraEl) {
            cameraEl.style.transition = `transform ${durationSec}s linear`;
            cameraEl.classList.remove('camera-smooth');
            this.applyCameraTransform(false);
        }
    }

    // Reset to full board overview
    resetCameraToFullView(duration = 0.85) {
        this.camera.isZoomed = false;
        this.camera.scale = 1.0;
        this.camera.x = 0;
        this.camera.y = 0;
        this.updateCameraPillText();

        const cameraEl = document.getElementById('board-camera');
        if (cameraEl) {
            cameraEl.style.transition = `transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1)`;
            cameraEl.classList.add('camera-smooth');
            this.applyCameraTransform(true);
        }
    }

    // Toggle camera between full overview and following active play
    toggleCameraZoom() {
        if (this.camera.isZoomed) {
            this.followAction = false;
            this.resetCameraToFullView(0.85);
        } else {
            this.followAction = true;
            const activePos = (this.activeMovingPlayerId && this.playerPositions[this.activeMovingPlayerId] !== undefined)
                ? this.playerPositions[this.activeMovingPlayerId]
                : (this.playerPositions[this.myId] ?? 0);
            this.zoomInToToken(activePos, 0.85);
        }
    }

    updateCameraPillText() {
        const pill = document.getElementById('btn-camera-toggle');
        const text = document.getElementById('cam-mode-text');
        const icon = document.getElementById('cam-icon');
        if (!pill || !text) return;

        if (this.camera.isZoomed) {
            pill.classList.add('active');
            text.textContent = 'Ver Todo';
            if (icon) icon.textContent = '🗺️';
            pill.title = 'Cambiar a Vista Completa del Tablero';
        } else {
            pill.classList.remove('active');
            text.textContent = 'Seguir';
            if (icon) icon.textContent = '🎯';
            pill.title = 'Seguir la ficha en primer plano';
        }
    }

    // Center on current player token (fallback / manual)
    centerOnMyToken() {
        if (!this.room || !this.myId) return;
        const me = this.room.players.find(p => p.id === this.myId);
        const targetPos = me ? me.position : 0;
        this.zoomInToToken(targetPos, 0.85);
    }

    softGlideToTile(tileNum, duration = 0.85) {
        if (!this.camera.isZoomed) return;
        this.calculateTargetCameraXY(tileNum);
        const cameraEl = document.getElementById('board-camera');
        if (cameraEl) {
            cameraEl.style.transition = `transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1)`;
            cameraEl.classList.add('camera-smooth');
            this.applyCameraTransform(true);
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
                if (this.camera.isZoomed) {
                    this.softGlideToTile(p.position);
                }
            });

            container.appendChild(dot);
        });
    }

    // ========================================================
    // 3. WEBSOCKET CONNECTION & SESSION RECONNECTION
    // ========================================================
    saveSession() {
        if (!this.room || !this.myId) return;
        const myPlayer = this.room.players?.find(p => p.id === this.myId);
        const session = {
            roomCode: this.room.code,
            playerId: this.myId,
            playerName: myPlayer ? myPlayer.name : '',
            avatar: myPlayer ? myPlayer.avatar : this.selectedAvatar,
            color: myPlayer ? myPlayer.color : this.selectedColor
        };
        try {
            localStorage.setItem('oca_session', JSON.stringify(session));
        } catch (e) {
            console.warn('Could not save session', e);
        }
    }

    getStoredSession() {
        try {
            const raw = localStorage.getItem('oca_session');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    clearSession() {
        try {
            localStorage.removeItem('oca_session');
        } catch (e) {}
    }

    showToast(message, duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                display: flex;
                flex-direction: column;
                gap: 8px;
                pointer-events: none;
                max-width: 90vw;
            `;
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = 'toast-bubble';
        toast.style.cssText = `
            background: rgba(15, 23, 42, 0.95);
            color: #ffffff;
            border: 1px solid #d4af37;
            border-radius: 20px;
            padding: 8px 18px;
            font-size: 0.88rem;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
            text-align: center;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.25s ease;
            pointer-events: auto;
        `;
        toast.textContent = message;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }, duration);
    }

    updateTurnTimerDisplay() {
        const timerBtn = document.getElementById('btn-turn-timer');
        if (!timerBtn || !this.room) return;

        if (this.turnTimerTicker) {
            clearInterval(this.turnTimerTicker);
            this.turnTimerTicker = null;
        }

        const timerSecs = this.room.settings?.turn_timer_seconds ?? 20;
        if (timerSecs <= 0) {
            timerBtn.textContent = '♾️ Sin límite';
            timerBtn.classList.remove('timer-urgent');
            timerBtn.title = this.isHost
                ? 'Modo sin límite de tiempo. Clic para activar 15s.'
                : 'Partida sin límite de tiempo por turno.';
            return;
        }

        const turnStartedAt = this.room.turn_started_at || Math.floor(Date.now() / 1000);
        const updateTick = () => {
            const now = Math.floor(Date.now() / 1000);
            const elapsed = Math.max(0, now - turnStartedAt);
            const remaining = Math.max(0, timerSecs - elapsed);

            timerBtn.textContent = `⏱️ ${remaining}s`;
            if (remaining <= 5) {
                timerBtn.classList.add('timer-urgent');
            } else {
                timerBtn.classList.remove('timer-urgent');
            }
        };

        updateTick();
        this.turnTimerTicker = setInterval(updateTick, 1000);
    }

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

            // Auto-reconnect if session exists
            const session = this.getStoredSession();
            if (session && session.roomCode && session.playerId) {
                this.showToast(`🔄 Reconectando a la sala ${session.roomCode}...`);
                this.send({
                    action: 'join_room',
                    room_code: session.roomCode,
                    player_name: session.playerName,
                    player_id: session.playerId,
                    avatar: session.avatar,
                    color: session.color
                });
            }
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
                this.saveSession();
                this.showWaitingLobby();
                break;

            case 'room_joined':
                this.myId = data.my_id;
                this.room = data.room;
                this.isHost = (this.room.host_id === this.myId);
                this.saveSession();
                if (this.room.status === 'playing') {
                    this.showGameView();
                    this.updateRoomStateUI();
                    if (data.is_reconnect) {
                        this.showToast('✅ ¡Reconectado a la partida!');
                    }
                } else {
                    this.showWaitingLobby();
                }
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
                this.enqueueTurnEvent(data.event);
                break;

            case 'turn_played':
                if (data.room) {
                    this.room = data.room;
                    this.updateRoomStateUI();
                }
                if (data.event) {
                    if (data.was_timeout) {
                        this.showToast(`⏱️ Tiempo agotado: se tiró automáticamente para ${data.event.player_name}`);
                    }
                    this.enqueueTurnEvent(data.event);
                }
                break;

            case 'chat_message':
                this.addChatMessage(data.chat);
                break;

            case 'error':
                if (data.message && (data.message.includes('no encontrada') || data.message.includes('llena'))) {
                    this.clearSession();
                }
                this.showToast('⚠️ ' + data.message);
                break;

            case 'pong':
                break;
        }
    }

    // ========================================================
    // 5. GAME FLOW & CINEMATIC ACTION CAMERA (QUEUE-DRIVEN)
    // ========================================================
    enqueueTurnEvent(event) {
        this.turnQueue.push(event);
        this.processTurnQueue();
    }

    async processTurnQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        while (this.turnQueue.length > 0) {
            const nextEvent = this.turnQueue.shift();
            try {
                await this.handleTurnEvent(nextEvent);
            } catch (err) {
                console.error('Error procesando evento de turno:', err);
            }
        }

        this.isProcessingQueue = false;
        this.activeMovingPlayerId = null;
        this.isAnimating = false;
        this.renderPlayerTokens();
        this.updateTurnControls();
    }

    async handleTurnEvent(event) {
        this.isAnimating = true;
        this.activeMovingPlayerId = event.player_id;
        const rollBtn = document.getElementById('btn-roll-dice');
        if (rollBtn) rollBtn.disabled = true;

        const path = event.path || [];
        const isMyTurn = (event.player_id === this.myId);

        // Crucial fix: The token must start anchored at event.from_pos before roll
        const startPos = (event.from_pos !== undefined && event.from_pos !== null)
            ? event.from_pos
            : (this.playerPositions[event.player_id] ?? 0);

        this.playerPositions[event.player_id] = startPos;
        this.moveTokenTo(event.player_id, startPos);

        // Action Camera: If followAction is enabled, smoothly focus on the active player who is rolling!
        if (this.followAction) {
            if (!this.camera.isZoomed) {
                this.zoomInToToken(startPos, 0.7);
                await this.sleep(250);
            } else {
                this.softGlideToTile(startPos, 0.5);
                await this.sleep(150);
            }
        }

        // Animate 3D Dice Roll
        this.animateDiceRoll(event.dice, event.total);
        if (window.ocaAudio) window.ocaAudio.playDiceRoll();

        await this.sleep(700);

        // Token hops step by step sequentially along path
        // Camera slowly and steadily tracks the chip on each step in a continuous flow
        const hopStepTime = 240; // ms per hop
        if (path.length > 0) {
            for (let i = 0; i < path.length; i++) {
                const stepPos = path[i];
                this.playerPositions[event.player_id] = stepPos;
                this.moveTokenTo(event.player_id, stepPos);
                this.highlightCard(stepPos);

                if (window.ocaAudio) window.ocaAudio.playStep();

                if (this.followAction && this.camera.isZoomed) {
                    this.trackStepWithCamera(stepPos, 0.24);
                }

                await this.sleep(hopStepTime);
            }
        }

        // Handle intermediate vs final jump (Oca chain, Puente, Muerte, Laberinto)
        const lastStep = path.length > 0 ? path[path.length - 1] : startPos;
        if (event.final_pos !== lastStep) {
            await this.sleep(200);
            this.playerPositions[event.player_id] = event.final_pos;
            this.moveTokenTo(event.player_id, event.final_pos);
            this.highlightCard(event.final_pos);

            if (this.followAction && this.camera.isZoomed) {
                this.softGlideToTile(event.final_pos, 0.65);
            }
        } else {
            this.playerPositions[event.player_id] = event.final_pos;
            this.moveTokenTo(event.player_id, event.final_pos);
            this.highlightCard(event.final_pos);
        }

        // Special Tile Triggers & Rhymes
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

        // Log & Radar update
        this.addLogEntry(event);
        this.updateRaceRadar();

        // Handle Win
        if (event.is_win) {
            this.showVictoryModal(event.player_name);
            this.startConfetti();
        }

        // Pause to let the user admire the landed card and read the rhyme!
        await this.sleep(1350);

        // Keep camera zoomed in if following action so the board stays large & readable.
        // Only return to full view if user manually turned off followAction!
        if (!this.followAction && this.camera.isZoomed) {
            this.resetCameraToFullView(0.85);
            await this.sleep(500);
        }

        this.activeMovingPlayerId = null;
        this.isAnimating = false;
    }

    highlightCard(tileNum) {
        document.querySelectorAll('.svg-card-rect').forEach(r => r.classList.remove('active-tile'));
        const activeRect = document.getElementById(`rect-card-${tileNum}`);
        if (activeRect) {
            activeRect.classList.add('active-tile');
        }
    }

    markDiceSettled(cubeEl, value) {
        if (!cubeEl) return;
        cubeEl.classList.add('is-settled');
        cubeEl.setAttribute('data-face', value);
        cubeEl.querySelectorAll('.cube-face').forEach(face => {
            if (face.classList.contains(`face-${value}`)) {
                face.classList.add('active-face');
            } else {
                face.classList.remove('active-face');
            }
        });
    }

    animateDiceRoll(dice, total) {
        const c1 = document.getElementById('cube-die-1');
        const c2 = document.getElementById('cube-die-2');
        const totalDisplay = document.getElementById('dice-total-num');

        if (c1) {
            c1.classList.remove('is-settled');
            c1.removeAttribute('data-face');
            c1.classList.add('rolling');
        }
        if (c2 && dice.length > 1 && dice[1] > 0) {
            c2.style.display = 'block';
            c2.classList.remove('is-settled');
            c2.removeAttribute('data-face');
            c2.classList.add('rolling');
        } else if (c2 && (dice.length <= 1 || dice[1] === 0)) {
            c2.style.display = 'none';
        }

        setTimeout(() => {
            if (c1) {
                c1.classList.remove('rolling');
                const v1 = dice[0] || 1;
                this.setDiceRotation(c1, v1);
                this.markDiceSettled(c1, v1);
            }
            if (c2 && dice.length > 1 && dice[1] > 0) {
                c2.classList.remove('rolling');
                const v2 = dice[1] || 1;
                this.setDiceRotation(c2, v2);
                this.markDiceSettled(c2, v2);
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
        cubeEl.querySelectorAll('.cube-face').forEach(face => {
            if (face.classList.contains(`face-${value}`)) {
                face.classList.add('active-face');
            } else {
                face.classList.remove('active-face');
            }
        });
    }

    moveTokenTo(playerId, tileNum) {
        const player = this.room?.players?.find(p => p.id === playerId);
        const token = player ? this.ensureTokenElement(player) : document.getElementById(`token-group-${playerId}`);
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

        banner.onclick = () => {
            banner.classList.add('hidden');
            if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        };

        if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
        this.bannerTimeout = setTimeout(() => {
            banner.classList.add('hidden');
        }, 2800);
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
        const isMobile = window.innerWidth <= 768;
        if (isMobile && this.followAction) {
            const myPos = this.playerPositions[this.myId] ?? 0;
            this.zoomInToToken(myPos, 0.6);
        } else {
            this.resetCameraToFullView();
        }
    }

    updateRoomStateUI() {
        if (!this.room) return;

        if (this.room.status === 'waiting') {
            this.updateWaitingPlayersList();
            return;
        }

        this.updateTurnTimerDisplay();

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
        if (!this.isProcessingQueue && !this.isAnimating) {
            this.renderPlayerTokens();
        }
    }

    updateTurnControls() {
        const rollBtn = document.getElementById('btn-roll-dice');
        if (!rollBtn || !this.room) return;

        if (this.room.status !== 'playing' || this.isAnimating || this.isProcessingQueue) {
            rollBtn.disabled = true;
            return;
        }

        const currPlayer = this.room.players[this.room.current_turn];
        const isMyTurn = currPlayer && (currPlayer.id === this.myId) && !currPlayer.is_bot;

        if (isMyTurn) {
            rollBtn.disabled = false;

            // When your turn starts, focus on your chip so you see your options clearly
            if (this.followAction && !this.isAnimating && !this.isProcessingQueue) {
                const myPos = this.playerPositions[this.myId] ?? currPlayer.position ?? 0;
                if (!this.camera.isZoomed) {
                    this.zoomInToToken(myPos, 0.85);
                } else {
                    this.softGlideToTile(myPos, 0.65);
                }
            }
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

    requirePlayerName() {
        const input = document.getElementById('player-name-input');
        const name = input ? input.value.trim() : '';
        if (!name) {
            if (input) {
                input.classList.remove('input-shake-error');
                void input.offsetWidth;
                input.classList.add('input-shake-error');
                input.focus();
                setTimeout(() => input.classList.remove('input-shake-error'), 500);
            }
            this.showToast('⚠️ Por favor escribe tu nombre o apodo antes de continuar');
            return null;
        }
        return name;
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
            const name = this.requirePlayerName();
            if (!name) return;
            const twoDice = document.getElementById('chk-two-dice').checked;
            const timerSel = document.getElementById('sel-turn-timer');
            const timerVal = timerSel ? parseInt(timerSel.value, 10) : 20;
            this.send({
                action: 'create_room',
                player_name: name,
                color: this.selectedColor,
                avatar: this.selectedAvatar,
                two_dice: twoDice,
                turn_timer_seconds: isNaN(timerVal) ? 20 : timerVal
            });
        });

        document.getElementById('btn-join-room').addEventListener('click', () => {
            const name = this.requirePlayerName();
            if (!name) return;
            const codeInput = document.getElementById('join-code-input');
            const code = codeInput.value.trim().toUpperCase();
            if (!code) {
                this.showToast('⚠️ Introduce el código de la sala');
                codeInput.focus();
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
            const name = this.requirePlayerName();
            if (!name) return;
            this.send({
                action: 'create_room',
                player_name: name,
                color: this.selectedColor,
                avatar: this.selectedAvatar,
                two_dice: true,
                turn_timer_seconds: 20
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

        const timerBtn = document.getElementById('btn-turn-timer');
        if (timerBtn) {
            timerBtn.addEventListener('click', () => {
                if (!this.isHost) {
                    this.showToast('ℹ️ Solo el anfitrión puede alternar el temporizador.');
                    return;
                }
                this.send({ action: 'toggle_timer' });
            });
        }

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
                this.showToast('📋 ¡Enlace de sala copiado al portapapeles!');
            }).catch(() => {
                navigator.clipboard.writeText(this.room.code);
                this.showToast(`📋 ¡Código ${this.room.code} copiado!`);
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
                this.clearSession();
                window.location.href = window.location.pathname;
            }
        });

        document.getElementById('btn-restart-game').addEventListener('click', () => {
            document.getElementById('victory-modal').classList.add('hidden');
            this.send({ action: 'restart_game' });
        });
        document.getElementById('btn-victory-back-lobby').addEventListener('click', () => {
            this.clearSession();
            window.location.href = window.location.pathname;
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
