// ========================================================
// 🦆 EL JUEGO DE LA OCA - CLIENTE INTERACTIVO
// Motor del tablero espiral, WebSockets y animaciones
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
    // 1. BOARD DATA & SVG RENDERING
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

        // If fetch fails or empty, generate fallback board
        if (!this.boardDef) {
            this.boardDef = this.generateFallbackBoard();
        }

        // Precompute pixel coordinates on 1000x890 SVG viewport
        this.boardCoords = this.boardDef.map(tile => {
            const x = (tile.x_pct / 100.0) * 1000;
            const y = (tile.y_pct / 100.0) * 890;
            return { x, y, tile };
        });
    }

    generateFallbackBoard() {
        const tiles = [];
        // Tile 0
        tiles.push({
            number: 0,
            tile_type: 'normal',
            name: 'Salida',
            x_pct: 3.5,
            y_pct: 94.0
        });

        // 1..=63
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

            // Approximate percentage for spiral
            tiles.push({
                number: i,
                tile_type: t,
                name: `Casilla ${i}`,
                x_pct: 50,
                y_pct: 50
            });
        }
        return tiles;
    }

    renderBoardSVG() {
        const tilesGroup = document.getElementById('svg-tiles-group');
        const gardenGroup = document.getElementById('svg-garden-group');
        const spiralPath = document.getElementById('board-spiral-path');

        if (!tilesGroup || this.boardCoords.length === 0) return;

        tilesGroup.innerHTML = '';
        gardenGroup.innerHTML = '';

        // Generate spiral connecting background track
        let pathD = `M ${this.boardCoords[0].x} ${this.boardCoords[0].y}`;
        for (let i = 1; i < this.boardCoords.length; i++) {
            pathD += ` L ${this.boardCoords[i].x} ${this.boardCoords[i].y}`;
        }
        spiralPath.setAttribute('d', pathD);

        // Render tiles
        this.boardCoords.forEach(({ x, y, tile }) => {
            if (tile.number === 0) {
                // Starting nest
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${x}, ${y})`);
                g.innerHTML = `
                    <circle r="36" fill="#8d5b28" stroke="#ffb703" stroke-width="3" filter="url(#tileShadow)"/>
                    <text y="-8" text-anchor="middle" font-size="12" fill="#fff" font-weight="bold">SALIDA</text>
                    <text y="14" text-anchor="middle" font-size="22">🪺</text>
                `;
                tilesGroup.appendChild(g);
                return;
            }

            if (tile.number === 63) {
                // Grand Center Garden (La Gran Oca)
                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('transform', `translate(${x}, ${y})`);
                g.innerHTML = `
                    <circle r="72" fill="url(#gardenGrad)" stroke="#8d5b28" stroke-width="6" filter="url(#tileShadow)"/>
                    <circle r="60" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="6,4"/>
                    <text y="-28" text-anchor="middle" font-size="18" fill="#1d3557" font-weight="900" letter-spacing="1">META 63</text>
                    <text y="10" text-anchor="middle" font-size="44">🦆</text>
                    <text y="42" text-anchor="middle" font-size="13" fill="#1d3557" font-weight="800">GRAN OCA</text>
                `;
                gardenGroup.appendChild(g);
                return;
            }

            // Normal and Special Tiles
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', `translate(${x}, ${y})`);
            g.setAttribute('class', `board-tile-item tile-${tile.tile_type}`);

            let fillColor = 'url(#tileGradNormal)';
            let strokeColor = '#b08968';
            let icon = '';
            let label = tile.number.toString();

            switch (tile.tile_type) {
                case 'oca':
                    fillColor = 'url(#tileGradOca)';
                    strokeColor = '#ffd166';
                    icon = '🦆';
                    break;
                case 'puente':
                    fillColor = 'url(#tileGradPuente)';
                    strokeColor = '#a8dadc';
                    icon = '🌉';
                    break;
                case 'dados':
                    fillColor = '#8338ec';
                    strokeColor = '#ffbe0b';
                    icon = '🎲';
                    break;
                case 'posada':
                    fillColor = '#fb8500';
                    strokeColor = '#ffffff';
                    icon = '🏨';
                    break;
                case 'pozo':
                    fillColor = '#3a5a40';
                    strokeColor = '#a3b18a';
                    icon = '🕳️';
                    break;
                case 'laberinto':
                    fillColor = '#0077b6';
                    strokeColor = '#90e0ef';
                    icon = '🌀';
                    break;
                case 'carcel':
                    fillColor = '#4a4e69';
                    strokeColor = '#9a8c98';
                    icon = '⛓️';
                    break;
                case 'muerte':
                    fillColor = 'url(#tileGradDanger)';
                    strokeColor = '#ffffff';
                    icon = '💀';
                    break;
            }

            const isSpecial = tile.tile_type !== 'normal';
            const numFill = isSpecial ? '#ffffff' : '#4a3525';

            g.innerHTML = `
                <rect class="svg-tile-rect" x="-42" y="-38" width="84" height="76" rx="10" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${isSpecial ? 2.5 : 1.5}"/>
                <text class="svg-tile-text-num" x="${isSpecial ? '-22' : '0'}" y="${isSpecial ? '-18' : '-8'}" fill="${numFill}">${label}</text>
                ${icon ? `<text class="svg-tile-icon" x="12" y="10">${icon}</text>` : ''}
            `;

            tilesGroup.appendChild(g);
        });

        this.renderPlayerTokens();
    }

    renderPlayerTokens() {
        const tokensGroup = document.getElementById('svg-tokens-group');
        if (!tokensGroup || !this.room) return;

        tokensGroup.innerHTML = '';

        // Group players by position so they don't overlap completely
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
    }

    // ========================================================
    // 2. WEBSOCKET CONNECTION
    // ========================================================
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('Conectado al servidor de El Juego de la Oca');
            // Keep alive ping every 30s
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
    // 3. SERVER MESSAGES HANDLING
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
    // 4. GAME FLOW & ANIMATIONS
    // ========================================================
    async handleTurnEvent(event) {
        this.isAnimating = true;
        const rollBtn = document.getElementById('btn-roll-dice');
        if (rollBtn) rollBtn.disabled = true;

        // 1. Animate Dice Roll
        this.animateDiceRoll(event.dice, event.total);
        if (window.ocaAudio) window.ocaAudio.playDiceRoll();

        await this.sleep(850);

        // 2. Animate step-by-step movement along the path
        if (event.path && event.path.length > 0) {
            for (let i = 0; i < event.path.length; i++) {
                const stepPos = event.path[i];
                this.moveTokenTo(event.player_id, stepPos);
                if (window.ocaAudio) window.ocaAudio.playStep();
                await this.sleep(260);
            }
        }

        // 3. Handle Special Tile Triggers & Rhymes
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

        // 4. Log event
        this.addLogEntry(event);

        // 5. Handle Win
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
    // 5. UI VIEWS & UPDATES
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

        // Show/hide host controls
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
    }

    updateRoomStateUI() {
        if (!this.room) return;

        if (this.room.status === 'waiting') {
            this.updateWaitingPlayersList();
            return;
        }

        // Current turn info
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

        // Update players list standings in sidebar
        const listContainer = document.getElementById('game-players-list');
        if (listContainer) {
            listContainer.innerHTML = '';
            // Sort by position descending
            const sorted = [...this.room.players].sort((a, b) => b.position - a.position);

            sorted.forEach(p => {
                const item = document.createElement('div');
                const isCurr = currPlayer && (p.id === currPlayer.id);
                item.className = `game-player-item ${isCurr ? 'current-turn' : ''}`;
                item.style.borderLeft = `4px solid ${p.color}`;

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
    // 6. EVENT LISTENERS
    // ========================================================
    setupEventListeners() {
        // Tab switching in lobby
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-target');
                this.switchTab(e.currentTarget.id, target);
            });
        });

        // Tab switching in sidebar log/chat
        document.querySelectorAll('.log-tab').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.log-tab').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.log-body').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const target = document.getElementById(e.currentTarget.getAttribute('data-target'));
                if (target) target.classList.add('active');
            });
        });

        // Avatar selector
        document.querySelectorAll('.avatar-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.selectedAvatar = e.currentTarget.getAttribute('data-avatar');
            });
        });

        // Color selector
        document.querySelectorAll('.color-opt').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.color-opt').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.selectedColor = e.currentTarget.getAttribute('data-color');
            });
        });

        // Create Room
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

        // Join Room
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

        // Quick Solo vs Bots
        document.getElementById('btn-quick-solo').addEventListener('click', () => {
            const name = document.getElementById('player-name-input').value.trim() || 'Jugador 1';
            this.send({
                action: 'create_room',
                player_name: name,
                color: this.selectedColor,
                avatar: this.selectedAvatar,
                two_dice: true
            });
            // Automatically add bots after creation
            setTimeout(() => {
                this.send({ action: 'add_bot' });
                this.send({ action: 'add_bot' });
                setTimeout(() => {
                    this.send({ action: 'start_game' });
                }, 400);
            }, 500);
        });

        // Add Bot
        document.getElementById('btn-add-bot').addEventListener('click', () => {
            this.send({ action: 'add_bot' });
        });

        // Start Game
        document.getElementById('btn-start-game').addEventListener('click', () => {
            this.send({ action: 'start_game' });
        });

        // Roll Dice
        document.getElementById('btn-roll-dice').addEventListener('click', () => {
            this.send({ action: 'roll_dice' });
        });

        // Copy room code
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

        // Quick reaction shouts
        document.querySelectorAll('.btn-shout').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const shout = e.currentTarget.getAttribute('data-shout');
                this.send({
                    action: 'send_chat',
                    text: shout
                });
            });
        });

        // Chat Form
        document.getElementById('chat-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const input = document.getElementById('chat-input');
            const text = input.value.trim();
            if (text) {
                this.send({ action: 'send_chat', text });
                input.value = '';
            }
        });

        // Sound Toggle
        document.getElementById('btn-sound').addEventListener('click', (e) => {
            if (window.ocaAudio) {
                this.soundEnabled = window.ocaAudio.toggleMute();
                e.currentTarget.textContent = this.soundEnabled ? '🔊' : '🔇';
            }
        });

        // Rules Modal
        document.getElementById('btn-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').classList.remove('hidden');
        });
        document.getElementById('btn-close-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').classList.add('hidden');
        });
        document.getElementById('btn-got-rules').addEventListener('click', () => {
            document.getElementById('rules-modal').classList.add('hidden');
        });

        // Leave / Back
        document.getElementById('btn-leave').addEventListener('click', () => {
            if (confirm('¿Deseas salir de la sala actual?')) {
                window.location.reload();
            }
        });

        // Restart Game
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
    // 7. CONFETTI CELEBRATION
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

// Start application when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.ocaApp = new OcaGameApp();
});
