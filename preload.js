const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Receive events
    onMediaUpdate: (callback) => {
        ipcRenderer.on('media-update', (event, data) => callback(data));
    },
    onLyricsLoaded: (callback) => {
        ipcRenderer.on('lyrics-loaded', (event, data) => callback(data));
    },
    onClickThroughChanged: (callback) => {
        ipcRenderer.on('click-through-changed', (event, enabled) => callback(enabled));
    },
    onUpdateStatus: (callback) => {
        ipcRenderer.on('update-status', (event, status) => callback(status));
    },
    onToggleOnlyLyricsShortcut: (callback) => {
        ipcRenderer.on('toggle-only-lyrics-shortcut', () => callback());
    },

    // Media controls
    controlMedia: (action, extra) => {
        ipcRenderer.send('control-media', { action, extra });
    },
    resyncMedia: () => {
        ipcRenderer.send('resync-media');
    },

    // Window controls
    setClickThrough: (enabled) => {
        ipcRenderer.send('set-click-through', enabled);
    },
    setAlwaysOnTop: (enabled) => {
        ipcRenderer.send('set-always-on-top', enabled);
    },
    setWindowOpacity: (opacity) => {
        ipcRenderer.send('set-window-opacity', opacity);
    },
    minimizeWindow: () => {
        ipcRenderer.send('minimize-window');
    },
    closeWindow: () => {
        ipcRenderer.send('close-window');
    },
    openSettingsWindow: () => {
        ipcRenderer.send('open-settings-window');
    },
    closeSettingsWindow: () => {
        ipcRenderer.send('close-settings-window');
    },
    resizeWindow: (width, height) => {
        ipcRenderer.send('resize-window', { width, height });
    },

    // Settings synchronization across windows
    sendSettingChanged: (data) => {
        ipcRenderer.send('setting-changed', data);
    },
    onSettingChanged: (callback) => {
        ipcRenderer.on('setting-changed', (event, data) => callback(data));
    },

    // Manual lyrics search fallback
    searchLyricsManual: (query) => {
        return ipcRenderer.invoke('search-lyrics-manual', query);
    },

    // Updater APIs
    checkForUpdates: () => {
        return ipcRenderer.invoke('check-for-updates');
    },
    downloadUpdate: () => {
        return ipcRenderer.invoke('download-update');
    },
    installUpdate: () => {
        ipcRenderer.send('install-update');
    },
    getAppVersion: () => {
        return ipcRenderer.invoke('get-app-version');
    },
    platform: process.platform
});

