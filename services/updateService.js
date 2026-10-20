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
            if (process.platform === 'darwin') {
                // On macOS, unsigned apps cannot be installed by Squirrel.Mac.
                // We use a robust fallback script that unpacks the downloaded zip in cache
                // and replaces the app bundle cleanly without signature rejection.
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const { spawn } = require('child_process');

                    const cacheDir = path.join(app.getPath('userCache'), `${app.getName()}-updater`, 'pending');
                    const appBundlePath = path.resolve(app.getAppPath(), '..', '..', '..');

                    if (fs.existsSync(cacheDir)) {
                        const files = fs.readdirSync(cacheDir);
                        const zipFile = files.find(f => f.endsWith('.zip'));
                        if (zipFile && appBundlePath.endsWith('.app')) {
                            const fullZipPath = path.join(cacheDir, zipFile);
                            const tmpDir = path.join(app.getPath('temp'), `lively_update_${Date.now()}`);

                            const script = `
                                sleep 0.8
                                mkdir -p "${tmpDir}"
                                ditto -xk "${fullZipPath}" "${tmpDir}"
                                rm -rf "${appBundlePath}"
                                cp -R "${tmpDir}/LivelyLyrics.app" "${appBundlePath}"
                                xattr -cr "${appBundlePath}" 2>/dev/null || true
                                rm -rf "${tmpDir}"
                                open "${appBundlePath}"
                            `;

                            const child = spawn('/bin/bash', ['-c', script], {
                                detached: true,
                                stdio: 'ignore'
                            });
                            child.unref();
                            app.quit();
                            return;
                        }
                    }
                } catch (macErr) {
                    console.warn('[macOS AutoUpdater Fallback Error]:', macErr);
                }
            }

            autoUpdater.quitAndInstall(false, true);
        }
    }

    getStatus() {
        return this.status;
    }
}

module.exports = new UpdateService();
