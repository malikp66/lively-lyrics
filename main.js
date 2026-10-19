const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const mediaService = require('./services/mediaService');
const lyricsService = require('./services/lyricsService');
const updateService = require('./services/updateService');

// Prevent GPU Disk Cache lock errors & multiple instances
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// CRITICAL: Prevent Chromium from pausing timers/animations when user focuses on other windows
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

// Linux transparency & Wayland/X11 visual compatibility
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('enable-transparent-visuals');
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

let mainWindow = null;
let tray = null;
let isClickThrough = false;
let currentTrackKey = '';
let positionSaveTimeout = null;

function getUnpackedOrLocalPath(...segments) {
    if (app && app.isPackaged) {
        const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', ...segments);
        if (fs.existsSync(unpacked)) return unpacked;
    }
    return path.join(__dirname, ...segments);
}

function getIconPath() {
    if (process.platform === 'win32') {
        const icoPath = getUnpackedOrLocalPath('public', 'icon.ico');
        if (fs.existsSync(icoPath)) return icoPath;
    }
    return getUnpackedOrLocalPath('public', 'icon.png');
}

function getTrayIcon() {
    if (process.platform === 'win32') {
        const icoPath = getUnpackedOrLocalPath('public', 'icon.ico');
        return nativeImage.createFromPath(icoPath);
    }
    if (process.platform === 'darwin') {
        const tplPath = getUnpackedOrLocalPath('public', 'trayTemplate.png');
        if (fs.existsSync(tplPath)) {
            const img = nativeImage.createFromPath(tplPath);
            img.setTemplateImage(true);
            return img;
        }
    }
    // Linux: use crisp 32x32 icon
    const png32 = getUnpackedOrLocalPath('public', 'icon-32.png');
    const pngPath = fs.existsSync(png32) ? png32 : getUnpackedOrLocalPath('public', 'icon.png');
    let img = nativeImage.createFromPath(pngPath);
    if (!img.isEmpty() && img.getSize().width > 32) {
        img = img.resize({ width: 32, height: 32, quality: 'best' });
    }
    return img;
}

function getBoundsStorePath() {
    return path.join(app.getPath('userData'), 'window-bounds.json');
}

function loadSavedPosition(defaultX, defaultY) {
    try {
        const filePath = getBoundsStorePath();
        if (fs.existsSync(filePath)) {
            const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (typeof raw.x === 'number' && typeof raw.y === 'number') {
                // Verify coordinates are within at least one visible display
                const displays = screen.getAllDisplays();
                const isVisible = displays.some(d => {
                    const b = d.bounds;
                    return raw.x >= b.x - 100 && raw.x <= b.x + b.width - 50 &&
                           raw.y >= b.y - 50 && raw.y <= b.y + b.height - 50;
                });
                if (isVisible) {
                    return { x: raw.x, y: raw.y };
                }
            }
        }
    } catch (e) {}
    return { x: defaultX, y: defaultY };
}

function saveWindowPosition() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
        const [x, y] = mainWindow.getPosition();
        fs.writeFileSync(getBoundsStorePath(), JSON.stringify({ x, y }), 'utf8');
    } catch (e) {}
}

function applyAlwaysOnTop(win, enabled) {
    if (!win || win.isDestroyed()) return;
    if (process.platform === 'darwin') {
        win.setAlwaysOnTop(enabled, 'floating', 1);
        win.setVisibleOnAllWorkspaces(enabled, { visibleOnFullScreen: true });
    } else {
        win.setAlwaysOnTop(enabled, 'screen-saver');
    }
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const winWidth = 520;
    const winHeight = 140;
    const defaultX = Math.max(20, screenWidth - winWidth - 30);
    const defaultY = Math.max(20, screenHeight - winHeight - 30);
    const { x: posX, y: posY } = loadSavedPosition(defaultX, defaultY);

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: posX,
        y: posY,
        minWidth: 380,
        minHeight: 110,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        show: false,
        icon: getIconPath(),
        skipTaskbar: false,
        backgroundColor: '#00000000',
        hasShadow: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));

    applyAlwaysOnTop(mainWindow, true);

    mainWindow.once('ready-to-show', () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.show();
        mainWindow.focus();
        console.log(`LivelyLyrics (${process.platform}) window ready at`, posX, posY);

        // Auto check for updates 5 seconds after startup
        setTimeout(() => {
            updateService.checkForUpdates().catch(() => {});
        }, 5000);
    });

    mainWindow.on('moved', () => {
        clearTimeout(positionSaveTimeout);
        positionSaveTimeout = setTimeout(saveWindowPosition, 400);
    });

    mainWindow.webContents.on('console-message', (event) => {
        const msg = event && typeof event === 'object' && 'message' in event ? event.message : arguments[2];
        const ln = event && typeof event === 'object' && 'lineNumber' in event ? event.lineNumber : arguments[3];
        if (msg && !String(msg).includes('Electron Security Warning')) {
            console.log(`[Renderer Line ${ln || 0}]:`, msg);
        }
    });

    // Register global shortcuts
    try {
        globalShortcut.unregisterAll();
        // Cmd/Ctrl+Alt+G: Ghost Mode
        globalShortcut.register('CommandOrControl+Alt+G', () => {
            toggleClickThrough();
        });

        // Cmd/Ctrl+Alt+L: Only Lyrics Mode
        globalShortcut.register('CommandOrControl+Alt+L', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('toggle-only-lyrics-shortcut');
            }
        });
    } catch (e) {
        console.warn('Failed to register global shortcut:', e);
    }

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        console.warn('[CrashGuard] Renderer process gone:', details.reason);
        if (details.reason !== 'clean-exit' && mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.reload();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// When a second instance is launched, focus our window instead of crashing
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

function toggleClickThrough() {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    isClickThrough = !isClickThrough;
    mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
    mainWindow.webContents.send('click-through-changed', isClickThrough);
}

function setupTray() {
    try {
        const trayIcon = getTrayIcon();
        tray = new Tray(trayIcon);
        const modLabel = process.platform === 'darwin' ? 'Cmd+Opt' : 'Ctrl+Alt';
        const contextMenu = Menu.buildFromTemplate([
            { label: '🎵 LivelyLyrics Miniplayer', enabled: false },
            { type: 'separator' },
            {
                label: `Mode Hanya Lirik (${modLabel}+L)`,
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('toggle-only-lyrics-shortcut');
                    }
                }
            },
            {
                label: `Toggle Ghost Mode (${modLabel}+G)`,
                click: () => toggleClickThrough()
            },
            {
                label: 'Always On Top',
                type: 'checkbox',
                checked: true,
                click: (item) => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        applyAlwaysOnTop(mainWindow, item.checked);
                    }
                }
            },
            {
                label: 'Pusatkan Jendela ke Layar',
                click: () => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.center();
                        mainWindow.show();
                        mainWindow.focus();
                        saveWindowPosition();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Periksa Pembaruan...',
                click: () => {
                    updateService.checkForUpdates();
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: 'Keluar (Exit)',
                click: () => {
                    mediaService.stop();
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('LivelyLyrics - Floating Synced Lyrics Miniplayer');
        tray.setContextMenu(contextMenu);
        tray.on('click', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
            } else if (BrowserWindow.getAllWindows().length === 0) {
                createWindow();
            }
        });
    } catch (err) {
        console.warn('Tray initialization skipped:', err.message);
    }
}

let lastMediaData = null;
let currentLyricsLoaded = false;
let currentLyricsSynced = false;

async function loadLyrics(data, force = false) {
    if (!data || !data.title) return;
    const trackKey = `${data.title} - ${data.artist}`.toLowerCase();
    if (force) {
        lyricsService.invalidateCache(trackKey);
    }
    try {
        const lyrics = await lyricsService.fetchLyrics(
            data.title,
            data.artist,
            data.album,
            data.duration,
            data.artworkUrl || ''
        );
        currentLyricsLoaded = !!(lyrics && (lyrics.hasSynced || lyrics.isPlain));
        currentLyricsSynced = !!(lyrics && lyrics.hasSynced);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('lyrics-loaded', {
                trackKey,
                lyrics
            });
        }
    } catch (err) {
        console.error('Failed to fetch lyrics:', err);
    }
}

// Media state handling
mediaService.on('mediaUpdate', async (data) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.webContents.send('media-update', data);

    if (data.active && data.title) {
        const trackKey = `${data.title} - ${data.artist}`.toLowerCase();
        const needsDurationRetry = !currentLyricsSynced && data.duration > 0 && (!lastMediaData || !lastMediaData.duration);
        if (trackKey !== currentTrackKey || !currentLyricsLoaded || needsDurationRetry) {
            currentTrackKey = trackKey;
            await loadLyrics(data);
        }
        lastMediaData = data;
    }
});

// Update service status forwarding to renderer
updateService.on('status-changed', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', status);
    }
});

// IPC listeners
ipcMain.on('control-media', async (event, { action, extra }) => {
    if (action === 'playpause') {
        mediaService.playPause();
    } else if (action === 'next') {
        mediaService.next();
    } else if (action === 'previous') {
        mediaService.previous();
    } else if (action === 'seek' && extra && typeof extra.position === 'number') {
        mediaService.seek(extra.position);
    } else if (action === 'resync') {
        mediaService.resync();
        if (lastMediaData && lastMediaData.active) {
            await loadLyrics(lastMediaData, true);
        }
    }
});

ipcMain.on('resync-media', async () => {
    mediaService.resync();
    if (lastMediaData && lastMediaData.active) {
        await loadLyrics(lastMediaData, true);
    }
});

ipcMain.on('set-click-through', (event, enabled) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    isClickThrough = !!enabled;
    mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
    mainWindow.webContents.send('click-through-changed', isClickThrough);
});

ipcMain.on('set-always-on-top', (event, enabled) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    applyAlwaysOnTop(mainWindow, !!enabled);
});

ipcMain.on('set-window-opacity', (event, opacity) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const clamped = Math.max(0.15, Math.min(1.0, opacity));
    mainWindow.setOpacity(clamped);
});

ipcMain.on('minimize-window', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
    saveWindowPosition();
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.on('resize-window', (event, { width, height }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setSize(width, height);
    }
});

ipcMain.handle('search-lyrics-manual', async (event, query) => {
    return await lyricsService.fetchLyrics(query, '', '', 0);
});

ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// Auto-Updater IPC
ipcMain.handle('check-for-updates', async () => {
    return await updateService.checkForUpdates();
});

ipcMain.handle('download-update', async () => {
    return await updateService.downloadUpdate();
});

ipcMain.on('install-update', () => {
    updateService.quitAndInstall();
});

const startApp = () => {
    if (process.platform === 'darwin' && app.dock) {
        try {
            app.dock.setIcon(getIconPath());
        } catch (e) {}
    }
    createWindow();
    setupTray();
    mediaService.start();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.show();
            mainWindow.focus();
        }
    });
};

app.whenReady().then(() => {
    // On Linux X11 compositors, slight delay ensures ARGB visual transparency is initialized cleanly
    if (process.platform === 'linux') {
        setTimeout(startApp, 300);
    } else {
        startApp();
    }
});

app.on('will-quit', () => {
    saveWindowPosition();
    globalShortcut.unregisterAll();
    mediaService.stop();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        mediaService.stop();
        app.quit();
    }
});

process.on('uncaughtException', (err) => {
    console.error('[CrashGuard] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CrashGuard] Unhandled Rejection at:', promise, 'reason:', reason);
});
