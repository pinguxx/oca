// ========================================================
// 🦆 Sintetizador de Efectos de Sonido y Locución de Voz
// Web Audio API + SpeechSynthesis API (Cero dependencias)
// ========================================================

class OcaAudio {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.currentLang = localStorage.getItem('oca_lang') || 'es';
        this.spanishVoice = null;
        this.englishVoice = null;

        // Cargar voces del sintetizador de voz del navegador
        if ('speechSynthesis' in window) {
            const loadVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                this.spanishVoice = voices.find(v => v.lang.startsWith('es') || v.lang.includes('MX') || v.lang.includes('ES')) || null;
                this.englishVoice = voices.find(v => v.lang.startsWith('en') || v.lang.includes('US') || v.lang.includes('GB')) || null;
            };
            loadVoices();
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setLanguage(lang) {
        this.currentLang = lang;
    }

    toggleMute() {
        this.enabled = !this.enabled;
        if (!this.enabled && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        return this.enabled;
    }

    // Locución de voz para grandes eventos (Web Speech API)
    speak(textEs, textEn) {
        if (!this.enabled || !('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel(); // Detener locución previa

        const text = (this.currentLang === 'en') ? textEn : textEs;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.05;

        if (this.currentLang === 'en') {
            utterance.lang = 'en-US';
            if (this.englishVoice) utterance.voice = this.englishVoice;
        } else {
            utterance.lang = 'es-MX';
            if (this.spanishVoice) utterance.voice = this.spanishVoice;
        }

        window.speechSynthesis.speak(utterance);
    }

    // Sonido al tirar los dados (ruido filtrado y rebotes)
    playDiceRoll() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const count = 5;
        for (let i = 0; i < count; i++) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            const time = now + i * 0.06;
            const freq = 160 + Math.random() * 180;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            osc.frequency.exponentialRampToValueAtTime(60, time + 0.05);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, time);

            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.06);
        }
    }

    // Sonido al avanzar casilla por casilla con timbre e instrumento distintivo por jugador
    playStep(playerIdx = 0, playerId = null) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        // Si playerIdx no es número válido o negativo, derivar índice determinista desde playerId
        let idx = typeof playerIdx === 'number' && playerIdx >= 0 ? playerIdx : 0;
        if ((idx === 0 && playerId) || isNaN(idx)) {
            let hash = 0;
            const str = String(playerId);
            for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
            idx = Math.abs(hash);
        }
        const profileIdx = idx % 8;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // 8 perfiles acústicos únicos y armoniosos inspirados en instrumentos tradicionales
        switch (profileIdx) {
            case 0: { // 🔴 Marimba Tradicional: Sine cálido C5 -> G5
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(660, now + 0.065);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.07);
                break;
            }
            case 1: { // ⚫ Cajón / Bongó: Triangle percusivo grave A3 -> D3
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(130, now + 0.06);
                gain.gain.setValueAtTime(0.24, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.07);
                break;
            }
            case 2: { // 🔵 Xilófono Cristalino: Sine brillante D5 -> A5
                osc.type = 'sine';
                osc.frequency.setValueAtTime(587, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.065);
                gain.gain.setValueAtTime(0.16, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.07);
                break;
            }
            case 3: { // 🟢 Glockenspiel / Campanilla: Triangle agudo G5 -> C6
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(784, now);
                osc.frequency.exponentialRampToValueAtTime(1046, now + 0.07);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.075);
                break;
            }
            case 4: { // 🟠 Clave de Madera: Triangle filtrado con toque seco
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(1150, now);
                filter.Q.setValueAtTime(4.0, now);

                osc.type = 'triangle';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(320, now + 0.05);
                gain.gain.setValueAtTime(0.28, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.055);
                break;
            }
            case 5: { // 🟣 Ocarina / Chiflidito: Sine suave y alegre C5 -> B5
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523, now);
                osc.frequency.exponentialRampToValueAtTime(988, now + 0.07);
                gain.gain.setValueAtTime(0.17, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.075);
                break;
            }
            case 6: { // 🌸 Jarana Punteada: Sawtooth con filtro cálido G4 -> D5
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(920, now);

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(392, now);
                osc.frequency.exponentialRampToValueAtTime(587, now + 0.065);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.07);
                break;
            }
            default: { // 🟡 Kalimba Resonante: Sine dulce E5 -> G5
                osc.type = 'sine';
                osc.frequency.setValueAtTime(659, now);
                osc.frequency.exponentialRampToValueAtTime(784, now + 0.07);
                gain.gain.setValueAtTime(0.17, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(now);
                osc.stop(now + 0.075);
                break;
            }
        }
    }

    // Sonido juguetón de burbuja / pop para reacciones en vivo
    playReactionPop() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(480 + Math.random() * 140, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.1);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.1);
    }

    // Graznido de Oca característico ("¡HONK! / ¡CUAK!")
    playGooseHonk() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // Dos tonos simultáneos para el timbre nasal del ganso/oca
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        osc1.frequency.setValueAtTime(280, now);
        osc1.frequency.linearRampToValueAtTime(420, now + 0.08);
        osc1.frequency.linearRampToValueAtTime(260, now + 0.22);

        osc2.frequency.setValueAtTime(285, now);
        osc2.frequency.linearRampToValueAtTime(430, now + 0.08);
        osc2.frequency.linearRampToValueAtTime(265, now + 0.22);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(950, now);
        filter.Q.setValueAtTime(3.0, now);

        gain.gain.setValueAtTime(0.01, now);
        gain.gain.linearRampToValueAtTime(0.28, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
    }

    // Sonido de Puente / Agua corriendo
    playBridge() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [330, 440, 550, 660];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const time = now + idx * 0.07;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.18, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.28);
        });
    }

    // Sonido de Trampa / Cárcel / Pozo (tono descendente dramático)
    playTrap() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.45);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.46);
    }

    // Sonido de La Muerte / Calavera (toque fúnebre cómico)
    playDeath() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const notes = [220, 207, 196, 174];
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const time = now + idx * 0.18;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);

            gain.gain.setValueAtTime(0.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(time);
            osc.stop(time + 0.26);
        });
    }

    // Fanfarria de Victoria (Arpegio triunfal estilo mariachi/fiesta)
    playVictory() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const fanfare = [
            { f: 523.25, d: 0.14 }, // C5
            { f: 659.25, d: 0.14 }, // E5
            { f: 783.99, d: 0.14 }, // G5
            { f: 1046.50, d: 0.35 }, // C6
            { f: 783.99, d: 0.12 }, // G5
            { f: 1046.50, d: 0.60 }  // C6 largo
        ];

        let cursor = now;
        fanfare.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'square';
            osc.frequency.setValueAtTime(note.f, cursor);

            gain.gain.setValueAtTime(0.22, cursor);
            gain.gain.exponentialRampToValueAtTime(0.001, cursor + note.d);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(cursor);
            osc.stop(cursor + note.d);

            cursor += note.d * 0.9;
        });
    }
}

window.ocaAudio = new OcaAudio();
