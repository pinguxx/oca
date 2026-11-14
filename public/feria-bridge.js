/**
 * 🎪 FERIA BRIDGE SDK • Conexión Cross-Game para La Feria
 * 
 * Permite que cualquier juego funcione tanto:
 * 1. STANDALONE: Modo autónomo si el usuario llega directamente.
 * 2. FERIA HUB: Modo conectado si el usuario llega desde La Feria con ?pass=...&hub=...
 * 
 * Inyecta automáticamente el botón «🎪 Volver a la Feria», pre-llena apodo y avatar,
 * y expone `window.FeriaBridge.reportWin({ coins, tickets, score })`.
 */
(function() {
  'use strict';

  // Configuración predeterminada
  const DEFAULT_HUB_URL = 'https://pinguxx.github.io/la-feria/';
  
  // 1. Extraer parámetros de URL
  const urlParams = new URLSearchParams(window.location.search);
  const passId = urlParams.get('pass') || '';
  const playerName = urlParams.get('player') || '';
  const playerAvatar = urlParams.get('avatar') || '🤼';
  const hubUrl = urlParams.get('hub') || DEFAULT_HUB_URL;
  const isFromFeria = Boolean(urlParams.get('hub') || urlParams.get('pass'));

  // 2. Helper de escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 3. Exponer API global
  window.FeriaBridge = {
    passId: passId,
    playerName: playerName,
    playerAvatar: playerAvatar,
    hubUrl: hubUrl,
    isFromFeria: isFromFeria,

    /**
     * Reporta una victoria o monedas ganadas de vuelta a La Feria
     */
    reportWin: async function(options) {
      if (!passId || !hubUrl) return false;
      const opts = options || {};
      const payload = {
        passport_id: passId,
        game_id: opts.gameId || window.location.pathname.replace(/^\/|\/$/g, '') || 'juego_satelite',
        coins: opts.coins || 50,
        tickets: opts.tickets || 2,
        score: opts.score || 0,
        note: opts.note || 'Victoria en partida'
      };

      try {
        const targetUrl = `${hubUrl.replace(/\/$/, '')}/api/rewards/award`;
        const res = await fetch(targetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        return res.ok;
      } catch (err) {
        console.warn('🎪 [FeriaBridge] No se pudo reportar recompensa al hub:', err);
        return false;
      }
    }
  };

  // 4. Inyectar estilos CSS para el botón «Volver a la Feria»
  function injectStyles() {
    if (document.getElementById('feria-bridge-styles')) return;
    const style = document.createElement('style');
    style.id = 'feria-bridge-styles';
    style.textContent = `
      .feria-bridge-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(15, 23, 42, 0.92);
        color: #fef08a;
        text-decoration: none;
        padding: 5px 12px;
        border-radius: 9999px;
        border: 1.5px solid #f59e0b;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 12.5px;
        font-weight: 700;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4), 0 0 10px rgba(245, 158, 11, 0.25);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 0.2s, background 0.2s, box-shadow 0.2s, border-color 0.2s;
        user-select: none;
        cursor: pointer;
        white-space: nowrap;
        pointer-events: auto;
      }

      .feria-bridge-btn:hover {
        background: rgba(30, 41, 59, 0.98);
        border-color: #fbbf24;
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55), 0 0 14px rgba(251, 191, 36, 0.45);
        color: #ffffff;
      }

      .feria-bridge-btn:active {
        transform: translateY(0);
      }

      .feria-bridge-in-header {
        position: relative;
        z-index: 50;
        margin-right: 6px;
      }

      .feria-bridge-floating {
        position: fixed;
        bottom: 18px;
        left: 18px;
        z-index: 999999;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5), 0 0 14px rgba(245, 158, 11, 0.35);
      }

      .feria-bridge-icon {
        font-size: 15px;
        line-height: 1;
      }

      .feria-bridge-label {
        letter-spacing: 0.3px;
      }

      .feria-bridge-player-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: rgba(245, 158, 11, 0.22);
        border: 1px solid rgba(245, 158, 11, 0.45);
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 11px;
        color: #fbbf24;
        margin-left: 2px;
      }

      @media (max-width: 640px) {
        .feria-bridge-btn {
          padding: 4px 9px;
          font-size: 11px;
          gap: 4px;
        }
        .feria-bridge-floating {
          bottom: 12px;
          left: 12px;
        }
        .feria-bridge-icon {
          font-size: 13px;
        }
        .feria-bridge-player-pill {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // 5. Inyectar botón en el DOM
  function injectBridgeUI() {
    let link = document.getElementById('feria-bridge-widget');
    injectStyles();

    if (!link) {
      link = document.createElement('a');
      link.id = 'feria-bridge-widget';
      link.href = hubUrl;
      link.setAttribute('rel', 'noopener noreferrer');

      if (isFromFeria) {
        link.title = 'Volver al portal principal de La Feria';
        link.innerHTML = `
          <span class="feria-bridge-icon" aria-hidden="true">🎪</span>
          <span class="feria-bridge-label">Volver a la Feria</span>
          ${playerName ? `<span class="feria-bridge-player-pill">${playerAvatar} ${escapeHtml(playerName)}</span>` : ''}
        `;
      } else {
        link.title = 'Explorar la colección completa de Juegos Tradicionales Mexicanos en La Feria';
        link.innerHTML = `
          <span class="feria-bridge-icon" aria-hidden="true">🎪</span>
          <span class="feria-bridge-label">La Feria</span>
        `;
      }
    }

    // Buscar si existe barra de acciones en cabecera
    const headerActions = document.querySelector('.header-actions, .header-controls');
    if (headerActions) {
      if (link.parentElement !== headerActions) {
        link.className = 'feria-bridge-btn feria-bridge-in-header';
        headerActions.insertBefore(link, headerActions.firstChild);
      }
    } else {
      if (!link.parentElement) {
        link.className = 'feria-bridge-btn feria-bridge-floating';
        document.body.appendChild(link);
      }
    }
  }

  // 6. Sincronizar almacenamiento local y memoria de juegos
  function syncPlayerStorage() {
    if (!playerName) return;

    const nameKeys = [
      'canicas_name',
      'pirinola_name',
      'rayuela_player_name',
      'basta_player_name',
      'loteria_player_name',
      'conquian_player_name',
      'oca_player_name',
      'shoots_player_name',
      'player_name',
      'playerName'
    ];
    nameKeys.forEach(k => {
      try {
        localStorage.setItem(k, playerName);
        sessionStorage.setItem(k, playerName);
        if (window.safeStorage && window.safeStorage.setItem) {
          window.safeStorage.setItem(k, playerName);
        }
      } catch (_) {}
    });

    if (playerAvatar) {
      const avatarKeys = [
        'canicas_avatar',
        'pirinola_avatar',
        'rayuela_avatar',
        'basta_avatar',
        'loteria_avatar',
        'conquian_avatar',
        'oca_avatar',
        'shoots_avatar'
      ];
      avatarKeys.forEach(k => {
        try {
          localStorage.setItem(k, playerAvatar);
          sessionStorage.setItem(k, playerAvatar);
          if (window.safeStorage && window.safeStorage.setItem) {
            window.safeStorage.setItem(k, playerAvatar);
          }
        } catch (_) {}
      });
    }
  }

  // Ejecutar de inmediato para anticipar la lectura inicial del juego en app.js
  if (isFromFeria) {
    syncPlayerStorage();
  }

  // 7. Pre-llenar inputs de nombre de jugador si vienen del pasaporte
  function autofillPlayerInfo() {
    if (!playerName) return;

    syncPlayerStorage();

    const selectors = [
      '#input-name',
      '#input-player-name',
      '#playerName',
      '#player-name',
      '#player',
      '#username',
      '#nickname',
      '#name',
      'input[name="playerName"]',
      'input[name="player_name"]',
      'input[name="nickname"]',
      'input[name="name"]'
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        // Actualizar siempre el valor cuando el usuario viene de La Feria
        if (el.value !== playerName) {
          el.value = playerName;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        break;
      }
    }

    if (playerAvatar) {
      try {
        const pickerItems = document.querySelectorAll('.picker-item, .avatar-option, .avatar-btn, [data-avatar]');
        for (const btn of pickerItems) {
          if (btn.textContent && (btn.textContent.trim() === playerAvatar || btn.textContent.includes(playerAvatar))) {
            btn.click();
            break;
          }
        }
      } catch (_) {}
    }
  }

  function initBridge() {
    syncPlayerStorage();
    injectBridgeUI();
    autofillPlayerInfo();

    // Re-checar si componentes de interfaz se cargan dinámicamente
    setTimeout(() => {
      syncPlayerStorage();
      injectBridgeUI();
      autofillPlayerInfo();
    }, 150);

    setTimeout(() => {
      syncPlayerStorage();
      injectBridgeUI();
      autofillPlayerInfo();
    }, 500);

    setTimeout(() => {
      injectBridgeUI();
      autofillPlayerInfo();
    }, 1500);
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBridge);
  } else {
    initBridge();
  }
})();
