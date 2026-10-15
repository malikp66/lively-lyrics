/**
 * updateService.js
 * Manages Auto-Updates for LivelyLyrics using electron-updater
 * with graceful offline and no-release fallbacks.
 */

const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const EventEmitter = require('events');

class UpdateService extends EventEmitter {
    constructor() {
        super();
        this.status = {
            state: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
            version: app.getVersion(),
            newVersion: null,
            progress: 0,
            message: ''
        };

        this.initAutoUpdater();
    }

    initAutoUpdater() {
        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('checking-for-update', () => {
            this.updateStatus('checking', { message: 'Sedang memeriksa pembaruan...' });
        });

        autoUpdater.on('update-available', (info) => {
            this.updateStatus('available', {
                newVersion: info.version,
                message: `Pembaruan v${info.version} tersedia!`
            });
        });

        autoUpdater.on('update-not-available', (info) => {
            this.updateStatus('not-available', {
                message: `LivelyLyrics Anda sudah versi terbaru (v${app.getVersion()}).`
            });
        });

        autoUpdater.on('error', (err) => {
            console.warn('[AutoUpdater Warning]:', err.message);
            this.updateStatus('error', {
                message: 'Belum ada rilis baru di cloud atau server belum dikonfigurasi.'
            });
        });

        autoUpdater.on('download-progress', (progressObj) => {
            this.updateStatus('downloading', {
                progress: Math.round(progressObj.percent),
                message: `Mengunduh pembaruan: ${Math.round(progressObj.percent)}%`
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            this.updateStatus('downloaded', {
                newVersion: info.version,
                message: `Pembaruan v${info.version} selesai diunduh! Klik untuk memasang.`
            });
        });
    }

    updateStatus(state, data = {}) {
        this.status = {
            ...this.status,
            state,
            ...data
        };
        this.emit('status-changed', this.status);
    }

    async checkForUpdates() {
        if (!app.isPackaged) {
            this.updateStatus('not-available', {
                message: `Mode Development (v${app.getVersion()}) - Pembaruan otomatis aktif pada versi terinstal.`
            });
            return this.status;
        }

        try {
            this.updateStatus('checking', { message: 'Memeriksa rilis terbaru...' });
            await autoUpdater.checkForUpdates();
        } catch (e) {
            this.updateStatus('error', { message: e.message });
        }
        return this.status;
    }

    async downloadUpdate() {
        if (this.status.state === 'available') {
            try {
                this.updateStatus('downloading', { progress: 0, message: 'Memulai pengunduhan...' });
                await autoUpdater.downloadUpdate();
            } catch (e) {
                this.updateStatus('error', { message: 'Gagal mengunduh pembaruan: ' + e.message });
            }
        }
    }

    quitAndInstall() {
        if (this.status.state === 'downloaded') {
            autoUpdater.quitAndInstall(false, true);
        }
    }

    getStatus() {
        return this.status;
    }
}

module.exports = new UpdateService();
