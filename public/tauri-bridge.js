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
        },
        onLyricsLoaded: (callback) => {
            listen('lyrics-loaded', (event) => callback(event.payload));
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
            invoke('resync_media');
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
})();
