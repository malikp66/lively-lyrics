/**
 * mediaService.js
 * Multi-platform background media controller and listener:
 * - Windows: PowerShell GSMTC Daemon (smtc-daemon.ps1)
 * - macOS: AppleScript / JXA (osascript)
 * - Linux: MPRIS2 / playerctl
 */

const { spawn, exec } = require('child_process');
const path = require('path');
const EventEmitter = require('events');
const { app } = require('electron');

class MediaService extends EventEmitter {
    constructor() {
        super();
        this.process = null;
        this.isStopping = false;
        this.lastKnownState = null;
        this.restartTimeout = null;
        this.macLinuxInterval = null;
        this.platform = process.platform;
    }

    getScriptPath() {
        if (app && app.isPackaged) {
            return path.join(process.resourcesPath, 'app.asar.unpacked', 'bridge', 'smtc-daemon.ps1');
        }
        return path.resolve(__dirname, '..', 'bridge', 'smtc-daemon.ps1');
    }

    start() {
        if (this.isStopping) return;

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

            this.process.on('close', (code) => {
                this.process = null;
                if (!this.isStopping) {
                    clearTimeout(this.restartTimeout);
                    this.restartTimeout = setTimeout(() => this.start(), 3000);
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
       macOS: AppleScript / Spotify Query
       ========================================================================= */
    startMacPolling() {
        this.emit('ready');
        const pollScript = `
        if application "Spotify" is running then
            tell application "Spotify"
                set pStatus to player state as string
                set tName to name of current track
                set tArtist to artist of current track
                set tAlbum to album of current track
                set tDuration to (duration of current track) / 1000
                set tPosition to player position
                return "{\"active\":true,\"title\":\"" & tName & "\",\"artist\":\"" & tArtist & "\",\"album\":\"" & tAlbum & "\",\"status\":\"" & (if pStatus is "playing" then "Playing" else "Paused") & "\",\"position\":" & tPosition & ",\"duration\":" & tDuration & "}"
            end tell
        else
            return "{\"active\":false}"
        end if
        `.replace(/\n/g, ' ');

        const poll = () => {
            if (this.isStopping) return;
            exec(`osascript -e '${pollScript}'`, (err, stdout) => {
                if (!err && stdout) {
                    try {
                        const parsed = JSON.parse(stdout.trim());
                        this.handleMessage({ event: 'mediaUpdate', data: parsed });
                    } catch (e) {}
                }
            });
        };

        poll();
        this.macLinuxInterval = setInterval(poll, 1000);
    }

    /* =========================================================================
       LINUX: playerctl / MPRIS2
       ========================================================================= */
    startLinuxPolling() {
        this.emit('ready');
        const poll = () => {
            if (this.isStopping) return;
            exec(`playerctl -p spotify status`, (errStatus, statusOut) => {
                if (errStatus || !statusOut.trim()) {
                    this.handleMessage({ event: 'mediaUpdate', data: { active: false } });
                    return;
                }
                const status = statusOut.trim() === 'Playing' ? 'Playing' : 'Paused';

                exec(`playerctl -p spotify metadata --format '{{title}}:::{{artist}}:::{{album}}:::{{position}}:::{{mpris:length}}'`, (errMeta, metaOut) => {
                    if (errMeta || !metaOut.trim()) return;
                    const parts = metaOut.trim().split(':::');
                    const title = parts[0] || '';
                    const artist = parts[1] || '';
                    const album = parts[2] || '';
                    const posMicro = parseFloat(parts[3]) || 0;
                    const lenMicro = parseFloat(parts[4]) || 0;

                    const data = {
                        active: true,
                        title,
                        artist,
                        album,
                        status,
                        position: Math.round((posMicro / 1000000) * 100) / 100,
                        duration: Math.round((lenMicro / 1000000) * 100) / 100
                    };
                    this.handleMessage({ event: 'mediaUpdate', data });
                });
            });
        };

        poll();
        this.macLinuxInterval = setInterval(poll, 1000);
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
            if (action === 'playpause') exec(`osascript -e 'tell application "Spotify" to playpause'`);
            else if (action === 'next') exec(`osascript -e 'tell application "Spotify" to next track'`);
            else if (action === 'previous') exec(`osascript -e 'tell application "Spotify" to previous track'`);
            else if (action === 'seek' && typeof extra.position === 'number') {
                exec(`osascript -e 'tell application "Spotify" to set player position to ${extra.position}'`);
            }
        } else if (this.platform === 'linux') {
            if (action === 'playpause') exec(`playerctl -p spotify play-pause`);
            else if (action === 'next') exec(`playerctl -p spotify next`);
            else if (action === 'previous') exec(`playerctl -p spotify previous`);
            else if (action === 'seek' && typeof extra.position === 'number') {
                exec(`playerctl -p spotify position ${extra.position}`);
            }
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
