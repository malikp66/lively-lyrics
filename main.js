const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, screen } = require('electron');
const path = require('path');
const mediaService = require('./services/mediaService');
const lyricsService = require('./services/lyricsService');
const updateService = require('./services/updateService');

// Prevent GPU Disk Cache lock errors & multiple instances
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

// CRITICAL: Prevent Chromium from pausing timers/animations when user focuses on other windows
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
}

let mainWindow = null;
let tray = null;
let isClickThrough = false;
let currentTrackKey = '';

function getIconPath() {
    if (app && app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.png');
    }
    return path.join(__dirname, 'public', 'icon.png');
}

function getTrayIconPath() {
    if (app && app.isPackaged) {
        return path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.ico');
    }
    return path.join(__dirname, 'public', 'icon.ico');
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const winWidth = 460;
    const winHeight = 275;
    // Position near bottom-right corner of screen
    const posX = Math.max(20, screenWidth - winWidth - 30);
    const posY = Math.max(20, screenHeight - winHeight - 30);

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        x: posX,
        y: posY,
        minWidth: 280,
        minHeight: 80,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
        show: true,
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

    mainWindow.setAlwaysOnTop(true);

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        console.log('LivelyLyrics window is ready and shown at', posX, posY);

        // Auto check for updates 5 seconds after startup
        setTimeout(() => {
            updateService.checkForUpdates().catch(() => {});
        }, 5000);
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[Renderer Line ${line}]:`, message);
    });

    // Register global shortcuts
    try {
        // Ctrl+Alt+G: Ghost Mode
        globalShortcut.register('CommandOrControl+Alt+G', () => {
            toggleClickThrough();
        });

        // Ctrl+Alt+L: Only Lyrics Mode
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
    if (!mainWindow) return;
    isClickThrough = !isClickThrough;
    mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
    mainWindow.webContents.send('click-through-changed', isClickThrough);
}

function setupTray() {
    try {
        const currentIcon = getTrayIconPath();
        const trayIcon = nativeImage.createFromPath(currentIcon);
        tray = new Tray(trayIcon);
        const contextMenu = Menu.buildFromTemplate([
            { label: '🎵 LivelyLyrics Miniplayer', enabled: false },
            { type: 'separator' },
            {
                label: 'Mode Hanya Lirik (Ctrl+Alt+L)',
                click: () => {
                    if (mainWindow) mainWindow.webContents.send('toggle-only-lyrics-shortcut');
                }
            },
            {
                label: 'Toggle Ghost Mode (Ctrl+Alt+G)',
                click: () => toggleClickThrough()
            },
            {
                label: 'Always On Top',
                type: 'checkbox',
                checked: true,
                click: (item) => {
                    if (mainWindow) mainWindow.setAlwaysOnTop(item.checked);
                }
            },
            {
                label: 'Pusatkan Jendela ke Layar',
                click: () => {
                    if (mainWindow) {
                        mainWindow.center();
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Periksa Pembaruan...',
                click: () => {
                    updateService.checkForUpdates();
                    if (mainWindow) {
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

        tray.setToolTip('LivelyLyrics - Spotify Floating Miniplayer');
        tray.setContextMenu(contextMenu);
        tray.on('click', () => {
            if (mainWindow) {
                mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show();
            }
        });
    } catch (err) {
        console.warn('Tray initialization skipped:', err.message);
    }
}

let lastMediaData = null;
let currentLyricsLoaded = false;

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
            data.duration
        );
        currentLyricsLoaded = !!(lyrics && (lyrics.hasSynced || lyrics.isPlain));
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
        lastMediaData = data;
        const trackKey = `${data.title} - ${data.artist}`.toLowerCase();
        if (trackKey !== currentTrackKey || !currentLyricsLoaded) {
            currentTrackKey = trackKey;
            await loadLyrics(data);
        }
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
    if (!mainWindow) return;
    isClickThrough = !!enabled;
    mainWindow.setIgnoreMouseEvents(isClickThrough, { forward: true });
    mainWindow.webContents.send('click-through-changed', isClickThrough);
});

ipcMain.on('set-always-on-top', (event, enabled) => {
    if (!mainWindow) return;
    mainWindow.setAlwaysOnTop(enabled);
});

ipcMain.on('set-window-opacity', (event, opacity) => {
    if (!mainWindow) return;
    const clamped = Math.max(0.15, Math.min(1.0, opacity));
    mainWindow.setOpacity(clamped);
});

ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.on('resize-window', (event, { width, height }) => {
    if (mainWindow) {
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

app.whenReady().then(() => {
    createWindow();
    setupTray();
    mediaService.start();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('will-quit', () => {
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
