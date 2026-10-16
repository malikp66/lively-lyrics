/**
 * mediaService.js
 * Multi-platform background media controller and listener:
 * - Windows: PowerShell GSMTC Daemon (smtc-daemon.ps1) with high-precision compensation
 * - macOS: JXA (JavaScript for Automation via osascript) supporting Spotify & Apple Music
 *            with safe JSON serialization (immune to quotes/newlines in song titles)
 * - Linux: MPRIS2 / playerctl supporting Spotify & active MPRIS players with single-call polling
 */

const { spawn, execFile } = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const { app } = require('electron');

// Safe JXA script for macOS (queries Spotify first, then Apple Music fallback)
const MAC_JXA_POLL_SCRIPT = `
function getPlayerState(appName) {
    try {
        var a = Application(appName);
        if (!a.running()) return null;
        var state = a.playerState();
        if (state !== 'playing' && state !== 'paused') return null;
        var track = a.currentTrack;
        if (!track) return null;
        var title = track.name() || '';
        if (!title) return null;
        var artist = track.artist() || '';
        var album = track.album() || '';
        var rawDur = track.duration() || 0;
        var duration = (appName === 'Spotify') ? (rawDur / 1000) : rawDur;
        var position = a.playerPosition() || 0;
        var artworkUrl = '';
        try {
            if (appName === 'Spotify') artworkUrl = track.artworkUrl() || '';
        } catch (e) {}
        return {
            active: true,
            appId: appName,
            title: String(title),
            artist: String(artist),
            album: String(album),
            status: (state === 'playing') ? 'Playing' : 'Paused',
            position: Math.round(position * 100) / 100,
            duration: Math.round(duration * 100) / 100,
            artworkUrl: String(artworkUrl),
            lastUpdated: Date.now()
        };
    } catch (e) {
        return null;
    }
}
var sp = getPlayerState('Spotify');
var mu = getPlayerState('Music');
var chosen = null;
if (sp && sp.status === 'Playing') chosen = sp;
else if (mu && mu.status === 'Playing') chosen = mu;
else if (sp) chosen = sp;
else if (mu) chosen = mu;
JSON.stringify(chosen || { active: false });
`.trim();

class MediaService extends EventEmitter {
    constructor() {
        super();
        this.process = null;
        this.isStopping = false;
        this.lastKnownState = null;
        this.restartTimeout = null;
        this.macLinuxInterval = null;
        this.isPollingInFlight = false;
        this.activeMacApp = 'Spotify';
        this.platform = process.platform;
    }

    getScriptPath() {
        if (app && app.isPackaged) {
            return path.join(process.resourcesPath, 'app.asar.unpacked', 'bridge', 'smtc-daemon.ps1');
        }
        return path.resolve(__dirname, '..', 'bridge', 'smtc-daemon.ps1');
    }

    start() {
        this.isStopping = false;

        if (this.platform === 'win32') {
            this.startWindowsDaemon();
        } else if (this.platform === 'darwin') {
            this.startMacPolling();
        } else if (this.platform === 'linux') {
            this.startLinuxPolling();
        } else {
            console.warn('[MediaService] Unsupported platform:', this.platform);
        }
    }

    /* =========================================================================
       WINDOWS: PowerShell SMTC Daemon
       ========================================================================= */
    startWindowsDaemon() {
        if (this.process) return;
        const scriptPath = this.getScriptPath();

        try {
            this.process = spawn('powershell.exe', [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy', 'Bypass',
                '-File', scriptPath
            ], {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });

            let buffer = '';

            this.process.stdout.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const parsed = JSON.parse(trimmed);
                        this.handleMessage(parsed);
                    } catch (e) {}
                }
            });

            this.process.stderr.on('data', (chunk) => {
                const str = chunk.toString();
                if (!str.includes('Warning') && !str.includes('DEBUG')) {
                    console.warn('[SMTC Daemon]:', str.trim());
                }
            });

            this.process.on('close', () => {
                this.process = null;
                if (!this.isStopping) {
                    clearTimeout(this.restartTimeout);
                    this.restartTimeout = setTimeout(() => this.start(), 2500);
                }
            });

            this.process.on('error', (err) => {
                console.error('[MediaService] Failed to spawn PowerShell SMTC process:', err);
                this.process = null;
            });
        } catch (err) {
            console.error('[MediaService] Windows SMTC daemon start error:', err);
        }
    }

    /* =========================================================================
       macOS: Safe JXA (JavaScript for Automation) Polling
       ========================================================================= */
    pollMacOnce() {
        if (this.isStopping || this.isPollingInFlight) return;
        this.isPollingInFlight = true;

        execFile('osascript', ['-l', 'JavaScript', '-e', MAC_JXA_POLL_SCRIPT], { timeout: 2500 }, (err, stdout) => {
            this.isPollingInFlight = false;
            if (!err && stdout) {
                try {
                    const parsed = JSON.parse(stdout.trim());
                    if (parsed && parsed.appId) {
                        this.activeMacApp = parsed.appId;
                    }
                    this.handleMessage({ event: 'mediaUpdate', data: parsed });
                } catch (e) {}
            } else if (err) {
                this.handleMessage({ event: 'mediaUpdate', data: { active: false } });
            }
        });
    }

    startMacPolling() {
        clearInterval(this.macLinuxInterval);
        this.emit('ready');
        this.pollMacOnce();
        this.macLinuxInterval = setInterval(() => this.pollMacOnce(), 900);
    }

    /* =========================================================================
       LINUX: MPRIS2 / playerctl (Single-command atomic query)
       ========================================================================= */
    pollLinuxOnce() {
        if (this.isStopping || this.isPollingInFlight) return;
        this.isPollingInFlight = true;

        const formatStr = '{{playerName}}:::{{status}}:::{{title}}:::{{artist}}:::{{album}}:::{{position}}:::{{mpris:length}}:::{{mpris:artUrl}}';

        execFile('playerctl', [
            '-p', 'spotify,%any',
            'metadata',
            '--format', formatStr
        ], { timeout: 2000 }, (err, stdout) => {
            this.isPollingInFlight = false;
            if (err || !stdout || !stdout.trim()) {
                this.handleMessage({ event: 'mediaUpdate', data: { active: false } });
                return;
            }

            const firstLine = stdout.trim().split('\n')[0];
            const parts = firstLine.split(':::');
            if (parts.length < 7) {
                this.handleMessage({ event: 'mediaUpdate', data: { active: false } });
                return;
            }

            const playerName = parts[0] || 'spotify';
            const rawStatus = (parts[1] || '').trim();
            const title = (parts[2] || '').trim();
            const artist = (parts[3] || '').trim();
            const album = (parts[4] || '').trim();
            const posMicro = parseFloat(parts[5]) || 0;
            const lenMicro = parseFloat(parts[6]) || 0;
            const artworkUrl = (parts[7] || '').trim();

            if (!title) {
                this.handleMessage({ event: 'mediaUpdate', data: { active: false } });
                return;
            }

            const data = {
                active: true,
                appId: playerName,
                title,
                artist,
                album,
                status: rawStatus === 'Playing' ? 'Playing' : 'Paused',
                position: Math.round((posMicro / 1000000) * 100) / 100,
                duration: Math.round((lenMicro / 1000000) * 100) / 100,
                artworkUrl: artworkUrl.startsWith('http') ? artworkUrl : '',
                lastUpdated: Date.now()
            };
            this.handleMessage({ event: 'mediaUpdate', data });
        });
    }

    startLinuxPolling() {
        clearInterval(this.macLinuxInterval);
        this.emit('ready');
        this.pollLinuxOnce();
        this.macLinuxInterval = setInterval(() => this.pollLinuxOnce(), 900);
    }

    handleMessage(msg) {
        if (msg.event === 'ready') {
            this.emit('ready');
        } else if (msg.event === 'mediaUpdate') {
            this.lastKnownState = msg.data;
            this.emit('mediaUpdate', msg.data);
        }
    }

    sendCommand(action, extra = {}) {
        if (this.platform === 'win32') {
            if (!this.process || !this.process.stdin || !this.process.stdin.writable) return;
            try {
                const payload = JSON.stringify({ action, ...extra }) + '\n';
                this.process.stdin.write(payload);
            } catch (e) {}
        } else if (this.platform === 'darwin') {
            const targetApp = (this.activeMacApp === 'Music') ? 'Music' : 'Spotify';
            let appleScript = '';
            if (action === 'playpause') {
                appleScript = `tell application "${targetApp}" to playpause`;
            } else if (action === 'next') {
                appleScript = `tell application "${targetApp}" to next track`;
            } else if (action === 'previous') {
                appleScript = `tell application "${targetApp}" to previous track`;
            } else if (action === 'seek' && typeof extra.position === 'number') {
                appleScript = `tell application "${targetApp}" to set player position to ${Number(extra.position)}`;
            }
            if (appleScript) {
                execFile('osascript', ['-e', appleScript], (err) => {
                    if (err) console.warn('[MediaService] macOS control error:', err.message);
                    setTimeout(() => this.pollMacOnce(), 80);
                });
            }
        } else if (this.platform === 'linux') {
            const args = ['-p', 'spotify,%any'];
            if (action === 'playpause') args.push('play-pause');
            else if (action === 'next') args.push('next');
            else if (action === 'previous') args.push('previous');
            else if (action === 'seek' && typeof extra.position === 'number') {
                args.push('position', String(Number(extra.position)));
            } else {
                return;
            }
            execFile('playerctl', args, () => {
                setTimeout(() => this.pollLinuxOnce(), 120);
            });
        }
    }

    playPause() {
        this.sendCommand('playpause');
    }

    next() {
        this.sendCommand('next');
    }

    previous() {
        this.sendCommand('previous');
    }

    seek(seconds) {
        this.sendCommand('seek', { position: seconds });
    }

    resync() {
        if (this.platform === 'win32') {
            this.sendCommand('resync');
        } else if (this.platform === 'darwin') {
            this.pollMacOnce();
        } else if (this.platform === 'linux') {
            this.pollLinuxOnce();
        }
    }

    stop() {
        this.isStopping = true;
        clearTimeout(this.restartTimeout);
        clearInterval(this.macLinuxInterval);
        if (this.process) {
            try {
                this.process.kill();
            } catch (e) {}
            this.process = null;
        }
    }
}

module.exports = new MediaService();
