/**
 * tauri-bridge.js
 * Universal runtime adapter for LivelyLyrics.
 * Bridges Tauri v2 Rust IPC to the existing window.electronAPI contract.
 */
(function () {
    if (window.electronAPI) {
        // Already initialized by Electron preload
        return;
    }

    const tauri = window.__TAURI__;
    if (!tauri) {
        console.warn('[LivelyLyrics Bridge] Tauri runtime not detected');
        return;
    }

    const invoke = tauri.core.invoke;
    const listen = tauri.event.listen;

    window.electronAPI = {
        // Receive events
        onMediaUpdate: (callback) => {
            listen('media-update', (event) => callback(event.payload));
            invoke('get_current_media').then((media) => {
                if (media && media.active) callback(media);
            }).catch(() => {});
        },
        onLyricsLoaded: (callback) => {
            listen('lyrics-loaded', (event) => callback(event.payload));
            invoke('get_current_lyrics').then((payload) => {
                if (payload && payload.lyrics) callback(payload);
            }).catch(() => {});
        },
        onClickThroughChanged: (callback) => {
            listen('click-through-changed', (event) => callback(event.payload));
        },
        onUpdateStatus: (callback) => {
            listen('update-status', (event) => callback(event.payload));
        },
        onToggleOnlyLyricsShortcut: (callback) => {
            listen('toggle-only-lyrics-shortcut', () => callback());
        },

        // Media controls
        controlMedia: (action, extra) => {
            let extraVal = null;
            if (typeof extra === 'number') {
                extraVal = extra;
            } else if (extra && typeof extra.position === 'number') {
                extraVal = extra.position;
            }
            invoke('control_media', { action, extra: extraVal });
        },
        resyncMedia: () => {
            invoke('resync_media').catch(() => {});
        },

        // Window controls
        setClickThrough: (enabled) => {
            invoke('set_click_through', { enabled: !!enabled });
        },
        setAlwaysOnTop: (enabled) => {
            invoke('set_always_on_top', { enabled: !!enabled });
        },
        setWindowOpacity: (opacity) => {
            const clamped = Math.max(0.15, Math.min(1.0, Number(opacity) || 1.0));
            const container = document.getElementById('app-container');
            if (container) {
                container.style.opacity = clamped;
            }
            invoke('set_window_opacity', { opacity: clamped });
        },
        minimizeWindow: () => {
            invoke('minimize_window');
        },
        closeWindow: () => {
            invoke('close_window');
        },
        resizeWindow: (w, h) => {
            let width = w;
            let height = h;
            if (typeof w === 'object' && w !== null) {
                width = w.width;
                height = w.height;
            }
            invoke('resize_window', { width: Number(width), height: Number(height) });
        },

        // Manual lyrics search fallback
        searchLyricsManual: (query) => {
            return invoke('search_lyrics_manual', { query });
        },

        // Updater & Version APIs
        checkForUpdates: () => {
            return Promise.resolve({ updateAvailable: false });
        },
        downloadUpdate: () => {
            return Promise.resolve();
        },
        installUpdate: () => {},
        getAppVersion: () => {
            return invoke('get_app_version');
        },
        platform: 'darwin'
    };

    invoke('get_platform').then((plat) => {
        if (window.electronAPI) {
            window.electronAPI.platform = plat;
        }
    }).catch(() => {});

    // In-window keyboard shortcut fallback
    window.addEventListener('keydown', (e) => {
        const isCmdOrCtrl = e.metaKey || e.ctrlKey;
        if (isCmdOrCtrl && e.altKey && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            const btnGhost = document.getElementById('btn-ghost');
            const isNowGhost = btnGhost ? !btnGhost.classList.contains('active') : true;
            invoke('set_click_through', { enabled: isNowGhost });
        } else if (isCmdOrCtrl && e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault();
            const btnOnly = document.getElementById('btn-only-lyrics');
            if (btnOnly) btnOnly.click();
        }
    });

    // Native window dragging on mousedown for Tauri (main card & settings modal)
    window.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;

        const target = e.target;
        if (!target) return;

        // Exclude interactive controls and scroll areas from initiating drag
        if (
            target.closest('button') ||
            target.closest('input') ||
            target.closest('select') ||
            target.closest('a') ||
            target.closest('.btn-icon') ||
            target.closest('.pill-btn') ||
            target.closest('.tab-btn') ||
            target.closest('.dock-btn') ||
            target.closest('.btn-close-modal') ||
            target.closest('.color-picker-input') ||
            target.closest('.glass-slider') ||
            target.closest('.settings-body-scroll') ||
            target.closest('.lyrics-scroll') ||
            target.closest('.lyrics-flow-container') ||
            target.closest('.scrubber-bar-container') ||
            target.closest('.scrubber-track') ||
            target.closest('.scrubber-progress') ||
            target.closest('.live-eq') ||
            target.closest('.quick-dropdown-menu')
        ) {
            return;
        }

        // Check if clicked in any draggable area
        if (
            target.closest('[data-tauri-drag-region]') ||
            target.closest('.island-main-split') ||
            target.closest('.island-player-panel') ||
            target.closest('.lyrics-stage') ||
            target.closest('.player-panel-header') ||
            target.closest('.drag-header') ||
            target.closest('.drag-region') ||
            target.closest('.modal-header') ||
            target.closest('.modal-title-row') ||
            target.closest('.track-info-layout') ||
            target.closest('.track-copy') ||
            target.closest('#drag-header') ||
            target.closest('.app-container')
        ) {
            if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
                window.__TAURI_INTERNALS__.invoke('plugin:window|start_dragging').catch(() => {});
            } else if (typeof invoke === 'function') {
                invoke('start_dragging').catch(() => {});
            }
        }
    });
})();
