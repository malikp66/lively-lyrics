/**
 * updateService.js
 * Manages Auto-Updates for LivelyLyrics using electron-updater
 * with GitHub API fallbacks and graceful offline handling.
 */

const { autoUpdater } = require('electron-updater');
const { app, shell } = require('electron');
const EventEmitter = require('events');

function parseSemver(v) {
    if (!v) return [0, 0, 0];
    const clean = String(v).replace(/^v/i, '').trim();
    const parts = clean.split(/[.-]/).map(p => parseInt(p, 10));
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function isNewer(remote, current) {
    const r = parseSemver(remote);
    const c = parseSemver(current);
    for (let i = 0; i < 3; i++) {
        if (r[i] > c[i]) return true;
        if (r[i] < c[i]) return false;
    }
    return false;
}

class UpdateService extends EventEmitter {
    constructor() {
        super();
        this.status = {
            state: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
            updateAvailable: false,
            version: app.getVersion(),
            newVersion: null,
            downloadUrl: null,
            releaseUrl: null,
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
                updateAvailable: true,
                message: `Pembaruan v${info.version} tersedia!`
            });
        });

        autoUpdater.on('update-not-available', (info) => {
            this.updateStatus('not-available', {
                updateAvailable: false,
                message: `LivelyLyrics Anda sudah versi terbaru (v${app.getVersion()}).`
            });
        });

        autoUpdater.on('error', (err) => {
            console.warn('[AutoUpdater Warning]:', err.message);
            if (this.status.state !== 'available') {
                this.updateStatus('error', {
                    updateAvailable: false,
                    message: 'Gagal memeriksa pembaruan via autoUpdater: ' + err.message
                });
            }
        });

        autoUpdater.on('download-progress', (progressObj) => {
            this.updateStatus('downloading', {
                progress: Math.round(progressObj.percent),
                updateAvailable: true,
                message: `Mengunduh pembaruan: ${Math.round(progressObj.percent)}%`
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            this.updateStatus('downloaded', {
                newVersion: info.version,
                updateAvailable: true,
                message: `Pembaruan v${info.version} selesai diunduh! Klik untuk memasang.`
            });
        });
    }

    updateStatus(state, data = {}) {
        const isAvail = (state === 'available' || state === 'downloading' || state === 'downloaded');
        this.status = {
            ...this.status,
            state,
            updateAvailable: data.updateAvailable !== undefined ? data.updateAvailable : isAvail,
            ...data
        };
        this.emit('status-changed', this.status);
    }

    async fetchLatestGitHubRelease() {
        try {
            const res = await fetch('https://api.github.com/repos/malikp66/lively-lyrics/releases/latest', {
                headers: { 'User-Agent': 'LivelyLyrics-Desktop' }
            });
            if (!res.ok) return null;
            const data = await res.json();
            if (!data || !data.tag_name) return null;

            const cleanTag = data.tag_name.replace(/^v/i, '').trim();
            let selectedAsset = null;

            if (Array.isArray(data.assets)) {
                if (process.platform === 'win32') {
                    selectedAsset = data.assets.find(a => a.name.endsWith('.exe') && a.name.toLowerCase().includes('setup'))
                        || data.assets.find(a => a.name.endsWith('.exe'));
                } else if (process.platform === 'darwin') {
                    const isArm = process.arch === 'arm64';
                    if (isArm) {
                        selectedAsset = data.assets.find(a => (a.name.endsWith('.dmg') || a.name.endsWith('.zip')) && a.name.toLowerCase().includes('arm64'))
                            || data.assets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.zip'));
                    } else {
                        selectedAsset = data.assets.find(a => (a.name.endsWith('.dmg') || a.name.endsWith('.zip')) && !a.name.toLowerCase().includes('arm64'))
                            || data.assets.find(a => a.name.endsWith('.dmg') || a.name.endsWith('.zip'));
                    }
                } else {
                    selectedAsset = data.assets.find(a => a.name.endsWith('.AppImage'))
                        || data.assets.find(a => a.name.endsWith('.deb'));
                }
            }

            return {
                tagName: data.tag_name,
                version: cleanTag,
                releaseUrl: data.html_url,
                downloadUrl: selectedAsset ? selectedAsset.browser_download_url : data.html_url,
                assetName: selectedAsset ? selectedAsset.name : null,
                body: data.body
            };
        } catch (e) {
            console.warn('[UpdateService] Failed to query GitHub Releases API:', e.message);
            return null;
        }
    }

    async checkForUpdates() {
        this.updateStatus('checking', { message: 'Memeriksa rilis terbaru...' });

        // 1. Try electron-updater if packaged
        let autoUpdaterSuccess = false;
        if (app.isPackaged) {
            try {
                const result = await autoUpdater.checkForUpdates();
                if (result && result.updateInfo) {
                    const remoteVer = result.updateInfo.version;
                    if (isNewer(remoteVer, app.getVersion())) {
                        autoUpdaterSuccess = true;
                        this.updateStatus('available', {
                            newVersion: remoteVer,
                            updateAvailable: true,
                            message: `Pembaruan v${remoteVer} tersedia!`
                        });
                    }
                }
            } catch (err) {
                console.warn('[AutoUpdater] checkForUpdates error:', err.message);
            }
        }

        // 2. Direct GitHub Release API fallback (handles unpacked dev & naming discrepancies in latest.yml)
        if (!autoUpdaterSuccess) {
            const ghRelease = await this.fetchLatestGitHubRelease();
            if (ghRelease && isNewer(ghRelease.version, app.getVersion())) {
                this.updateStatus('available', {
                    newVersion: ghRelease.version,
                    downloadUrl: ghRelease.downloadUrl,
                    releaseUrl: ghRelease.releaseUrl,
                    updateAvailable: true,
                    message: `Pembaruan v${ghRelease.version} tersedia!`
                });
                return this.status;
            } else if (ghRelease && !isNewer(ghRelease.version, app.getVersion())) {
                this.updateStatus('not-available', {
                    updateAvailable: false,
                    message: `LivelyLyrics Anda sudah menggunakan versi paling mutakhir (v${app.getVersion()}).`
                });
                return this.status;
            }
        }

        if (this.status.state === 'checking') {
            this.updateStatus('not-available', {
                updateAvailable: false,
                message: `LivelyLyrics Anda sudah menggunakan versi paling mutakhir (v${app.getVersion()}).`
            });
        }

        return this.status;
    }

    async downloadUpdate() {
        if (this.status.state === 'available') {
            try {
                this.updateStatus('downloading', { progress: 0, message: 'Memulai pengunduhan...' });
                if (app.isPackaged) {
                    await autoUpdater.downloadUpdate();
                } else {
                    throw new Error('Mode development: silakan unduh langsung dari GitHub.');
                }
            } catch (e) {
                console.warn('[AutoUpdater] downloadUpdate failed, falling back to browser download:', e.message);
                const targetUrl = this.status.downloadUrl || this.status.releaseUrl || 'https://github.com/malikp66/lively-lyrics/releases/latest';
                try {
                    await shell.openExternal(targetUrl);
                } catch (openErr) {
                    console.error('[AutoUpdater] Failed to open external URL:', openErr);
                }
                this.updateStatus('available', {
                    message: 'Membuka peramban untuk mengunduh installer versi terbaru...'
                });
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
        } else if (this.status.downloadUrl || this.status.releaseUrl) {
            shell.openExternal(this.status.downloadUrl || this.status.releaseUrl);
        }
    }

    getStatus() {
        return this.status;
    }
}

module.exports = new UpdateService();
