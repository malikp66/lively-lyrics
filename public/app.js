/**
 * app.js - LivelyLyrics v2.1
 * High-precision synchronization, ambient backdrop, theme customization,
 * Only-Lyrics Mode & In-App Auto-Updates.
 */

// Application State
let currentMedia = null;
let currentLyrics = null;
let currentTrackKey = '';
let activeLineIndex = -1;
let lastKnownPosition = 0;
let lastKnownTime = Date.now();
let isPlaying = false;

// User Preferences (from localStorage)
let userOffset = parseFloat(localStorage.getItem('lyric_offset') || '0');
let userTheme = localStorage.getItem('lyric_theme') || 'spotify';
let userFontSize = localStorage.getItem('lyric_font_size') || 'medium';
let userAlign = localStorage.getItem('lyric_align') || 'center';
let userBgStyle = localStorage.getItem('lyric_bg_style') || 'liquid';
let userCustomBgColor = localStorage.getItem('lyric_custom_bg_color') || '#0f172a';
let userSolidColor = localStorage.getItem('lyric_solid_color') || '#05070c';
let userGradientIndex = parseInt(localStorage.getItem('lyric_gradient_index') || '0', 10);
let showRemainingDuration = localStorage.getItem('show_remaining_duration') === 'true';
let userWindowBlur = localStorage.getItem('lyric_window_blur') || '28';
let userFontFamily = localStorage.getItem('lyric_font_family') || 'jakarta';
let userFontWeight = localStorage.getItem('lyric_font_weight') || '700';
let userTextGlow = localStorage.getItem('lyric_text_glow') || 'soft';
let userInactiveOpacity = localStorage.getItem('lyric_inactive_opacity') || '35';
let userCustomAccent = localStorage.getItem('lyric_custom_accent') || '';
let userTextColorMode = localStorage.getItem('lyric_text_color_mode') || 'white';
let userCustomTextColor = localStorage.getItem('lyric_custom_text_color') || '';
let userInactiveColor = localStorage.getItem('lyric_inactive_color') || '#cbd5e1';
let userFontStyle = localStorage.getItem('lyric_font_style') || 'normal';
let userTextStroke = localStorage.getItem('lyric_text_stroke') || 'none';
let isCompactMode = localStorage.getItem('is_compact_mode') === 'true';
let isOnlyLyricsMode = localStorage.getItem('only_lyrics_mode') === 'true';
let autoHideControls = localStorage.getItem('autohide_controls') !== 'false';
let ambientGlowEnabled = localStorage.getItem('ambient_glow') !== 'false';
let isAlwaysOnTop = true;

// Aesthetic Gradient Presets (for solid randomizing and chips)
const aestheticGradients = [
    { name: 'Aurora Glow', css: 'linear-gradient(135deg, #09203f 0%, #1e453e 50%, #14352a 100%)' },
    { name: 'Neon Cyber', css: 'linear-gradient(135deg, #120e38 0%, #1a2550 50%, #0d3b48 100%)' },
    { name: 'Sunset Velvet', css: 'linear-gradient(135deg, #2e1026 0%, #4a1936 50%, #662243 100%)' },
    { name: 'Deep Ocean', css: 'linear-gradient(135deg, #071b26 0%, #0d2b3a 50%, #143642 100%)' },
    { name: 'Cosmic Purple', css: 'linear-gradient(135deg, #190a2c 0%, #291244 50%, #3d1b5a 100%)' },
    { name: 'Nordic Night', css: 'linear-gradient(135deg, #101726 0%, #16243b 50%, #1e3352 100%)' },
    { name: 'Electric Violet', css: 'linear-gradient(135deg, #2b1055 0%, #4c1d95 50%, #7597de 100%)' },
    { name: 'Midnight Emerald', css: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #0f766e 100%)' },
    { name: 'Crimson Ember', css: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)' },
    { name: 'Abyssal Blue', css: 'linear-gradient(135deg, #030712 0%, #0c4a6e 50%, #0284c7 100%)' },
    { name: 'Twilight Rose', css: 'linear-gradient(135deg, #4c0519 0%, #831843 50%, #db2777 100%)' },
    { name: 'Golden Nebula', css: 'linear-gradient(135deg, #1c1917 0%, #451a03 50%, #78350f 100%)' }
];

// Available Fonts Configuration
const availableFonts = ['jakarta', 'inter', 'outfit', 'playfair', 'mono'];
const fontLabels = {
    'jakarta': 'Jakarta',
    'inter': 'Inter',
    'outfit': 'Outfit',
    'playfair': 'Playfair',
    'mono': 'Mono'
};

// DOM Elements
const bodyEl = document.body;
const appContainer = document.getElementById('app-container');
const splashScreen = document.getElementById('splash-screen');
const splashStatusText = document.getElementById('splash-status-text');
const ambientBackdrop = document.getElementById('ambient-backdrop');
const connectionDot = document.getElementById('connection-dot');
const trackHeaderTicker = document.getElementById('track-header-ticker');
const headerAvatarImg = document.getElementById('header-avatar-img');
const headerAvatarFallback = document.getElementById('header-avatar-fallback');
const trackCoverArt = document.getElementById('track-cover-art');
const coverPlaceholder = document.getElementById('cover-placeholder');
const trackNameEl = document.getElementById('track-name');
const artistNameEl = document.getElementById('artist-name');
const playbackBadge = document.getElementById('playback-status-badge');
const scrubberProgress = document.getElementById('scrubber-progress');
const scrubberContainer = document.getElementById('scrubber-container');
const scrubberTrack = document.getElementById('scrubber-track');
const currentTimeEl = document.getElementById('current-time');
const totalDurationEl = document.getElementById('total-duration');
const lyricsViewport = document.getElementById('lyrics-viewport');
const lyricsContainer = document.getElementById('lyrics-container');
const ghostBadge = document.getElementById('ghost-badge');

// Controls
const normalWindowActions = document.getElementById('normal-window-actions');
const btnOnlyLyrics = document.getElementById('btn-only-lyrics');
const onlyLyricsExitPill = document.getElementById('only-lyrics-exit-pill');
const btnExitOnlyLyrics = document.getElementById('btn-exit-only-lyrics');
const btnCloseOnlyLyrics = document.getElementById('btn-close-only-lyrics');
const btnSettingsPill = document.getElementById('btn-settings-pill');
const btnResyncPill = document.getElementById('btn-resync-pill');
const iconResyncPill = document.getElementById('icon-resync-pill');
const btnResync = document.getElementById('btn-resync');
const iconResyncHeader = document.getElementById('icon-resync-header');
const btnPin = document.getElementById('btn-pin');
const btnGhost = document.getElementById('btn-ghost');
const btnCompact = document.getElementById('btn-compact');
const btnSettings = document.getElementById('btn-settings');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

// Three Dots & Dropdown Menu Elements
const btnThreeDotsPlayer = document.getElementById('btn-three-dots-player');
const btnThreeDotsLyrics = document.getElementById('btn-three-dots-lyrics');
const quickDropdownMenu = document.getElementById('quick-dropdown-menu');
const dropdownItemSettings = document.getElementById('dropdown-item-settings');
const dropdownItemResync = document.getElementById('dropdown-item-resync');
const dropdownItemToggleLyrics = document.getElementById('dropdown-item-toggle-lyrics');
const dropdownIconLyrics = document.getElementById('dropdown-icon-lyrics');
const dropdownTextLyrics = document.getElementById('dropdown-text-lyrics');
const dropdownItemMinimize = document.getElementById('dropdown-item-minimize');
const dropdownItemClose = document.getElementById('dropdown-item-close');

// Playback Dock Controls (Three-Dots, Prev, Play/Pause, Next, Karaoke Toggle)
const btnLyricsToggle = document.getElementById('btn-lyrics-toggle');
const iconKaraokeDock = document.getElementById('icon-karaoke-dock');
const btnPlayPause = document.getElementById('btn-playpause');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');

// Auto-Marquee Horizontal Bounce for Track Title & Artist when overflowed
function updateMarquee(element) {
    if (!element || !element.parentElement) return;
    element.classList.remove('marquee-active');
    element.style.removeProperty('--marquee-distance');
    element.style.removeProperty('--marquee-duration');

    requestAnimationFrame(() => {
        const containerWidth = element.parentElement.clientWidth;
        const textWidth = element.scrollWidth;
        const overflow = textWidth - containerWidth;

        if (overflow > 4) {
            const distance = -(overflow + 8);
            const duration = Math.max(5, Math.min(14, overflow / 20 + 4));
            element.style.setProperty('--marquee-distance', `${distance}px`);
            element.style.setProperty('--marquee-duration', `${duration}s`);
            element.classList.add('marquee-active');
        }
    });
}

// Settings Modal Elements
const settingsPanel = document.getElementById('settings-panel');
const btnCloseSettings = document.getElementById('btn-close-settings');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const opacitySlider = document.getElementById('opacity-slider');
const opacityVal = document.getElementById('opacity-val');
const toggleOnlyLyricsSetting = document.getElementById('toggle-only-lyrics-setting');
const themeChips = document.querySelectorAll('.theme-chip');
const segFontBtns = document.querySelectorAll('.seg-btn');
const alignBtns = document.querySelectorAll('.align-btn');
const offsetValEl = document.getElementById('offset-val');
const btnOffsetM5 = document.getElementById('btn-offset-m5');
const btnOffsetM1 = document.getElementById('btn-offset-m1');
const btnOffsetReset = document.getElementById('btn-offset-reset');
const btnOffsetP1 = document.getElementById('btn-offset-p1');
const btnOffsetP5 = document.getElementById('btn-offset-p5');
const manualSearchInput = document.getElementById('manual-search-input');
const btnManualSearch = document.getElementById('btn-manual-search');
const manualSearchStatus = document.getElementById('manual-search-status');
const toggleAutoHide = document.getElementById('toggle-autohide');
const toggleAmbient = document.getElementById('toggle-ambient');
const togglePinSetting = document.getElementById('toggle-pin-setting');
const toggleGhostSetting = document.getElementById('toggle-ghost-setting');
const btnCollapsePlayer = document.getElementById('btn-collapse-player');
const btnExpandPlayer = document.getElementById('btn-expand-player');
const trackHeaderCard = document.getElementById('track-header-card');
const btnForceResync = document.getElementById('btn-force-resync');
const iconForceResync = document.getElementById('icon-force-resync');
const textForceResync = document.getElementById('text-force-resync');

// New Appearance Customization Elements
const bgStyleBtns = document.querySelectorAll('.bg-style-btn');
const rowBgSolidOptions = document.getElementById('row-bg-solid-options');
const rowBgGradientOptions = document.getElementById('row-bg-gradient-options');
const solidPresetBtns = document.querySelectorAll('.solid-preset-btn');
const bgCustomSolidColor = document.getElementById('bg-custom-solid-color');
const solidColorHexVal = document.getElementById('solid-color-hex-val');
const btnRandomGradient = document.getElementById('btn-random-gradient');
const gradientChipsContainer = document.getElementById('gradient-chips-container');
const gradientNameVal = document.getElementById('gradient-name-val');
const bgCustomColor = document.getElementById('bg-custom-color');
const bgColorHex = document.getElementById('bg-color-hex');
const blurSlider = document.getElementById('blur-slider');
const blurVal = document.getElementById('blur-val');
const fontBtns = document.querySelectorAll('.font-btn');
const weightBtns = document.querySelectorAll('.weight-btn');
const glowBtns = document.querySelectorAll('.glow-btn');
const inactiveOpacitySlider = document.getElementById('inactive-opacity-slider');
const inactiveOpacityVal = document.getElementById('inactive-opacity-val');
const customAccentColor = document.getElementById('custom-accent-color');
const accentHexVal = document.getElementById('accent-hex-val');
const textColorBtns = document.querySelectorAll('.text-color-btn');
const customTextColor = document.getElementById('custom-text-color');
const textColorHexVal = document.getElementById('text-color-hex-val');
const inactiveColorBtns = document.querySelectorAll('.inactive-color-btn');
const customInactiveColor = document.getElementById('custom-inactive-color');
const inactiveColorHexVal = document.getElementById('inactive-color-hex-val');
const fstyleBtns = document.querySelectorAll('.fstyle-btn');
const strokeBtns = document.querySelectorAll('.stroke-btn');

// Updates Tab Elements
const appVersionBadge = document.getElementById('app-version-badge');
const updateCurrentVersion = document.getElementById('update-current-version');
const updateStatusBox = document.getElementById('update-status-box');
const updateStatusText = document.getElementById('update-status-text');
const updateProgressBar = document.getElementById('update-progress-bar');
const updateProgressFill = document.getElementById('update-progress-fill');
const btnCheckUpdates = document.getElementById('btn-check-updates');
const btnDownloadUpdate = document.getElementById('btn-download-update');
const btnInstallUpdate = document.getElementById('btn-install-update');

// Live EQ & Tooltip Elements
const liveEq = document.getElementById('live-eq');
const playbackStatusText = document.getElementById('playback-status-text');
const scrubberTooltip = document.getElementById('scrubber-tooltip');
const btnFontPill = document.getElementById('btn-font-pill');
const fontPillLabel = document.getElementById('font-pill-label');

// Global Crash Prevention / Error Boundary
window.addEventListener('error', (err) => {
    console.warn('[Renderer Error Caught]:', err.message);
});
window.addEventListener('unhandledrejection', (err) => {
    console.warn('[Renderer Unhandled Rejection Caught]:', err.reason);
});

const currentPlatform = (window.electronAPI && window.electronAPI.platform) ? window.electronAPI.platform : 'win32';
const isMac = currentPlatform === 'darwin';
const modShortcut = isMac ? 'Cmd+Option' : 'Ctrl+Alt';
const resyncShortcut = isMac ? 'Cmd+R' : 'Ctrl+R';

// Initialize Saved Preferences & Dynamic Version
function applySavedPreferences() {
    try {
        // Dynamic Platform Labels & Shortcuts
        const platformNames = {
            darwin: 'macOS',
            linux: 'Linux',
            win32: 'Windows'
        };
        const bridgeNames = {
            darwin: 'macOS JXA Media Bridge (Spotify & Apple Music)',
            linux: 'Linux MPRIS2 / playerctl Bridge',
            win32: 'Windows SMTC Media Daemon'
        };
        const osName = platformNames[currentPlatform] || 'Desktop';
        const updateAppTitle = document.getElementById('update-app-title');
        if (updateAppTitle) updateAppTitle.textContent = `LivelyLyrics for ${osName}`;

        const syncBridgeSubtext = document.getElementById('sync-bridge-subtext');
        if (syncBridgeSubtext) {
            syncBridgeSubtext.textContent = `Paksa ${bridgeNames[currentPlatform] || 'sistem media'} mencocokkan detik playback secara instan tanpa jeda:`;
        }

        const ghostShortcutLabel = document.getElementById('ghost-shortcut-label');
        if (ghostShortcutLabel) ghostShortcutLabel.textContent = `${modShortcut}+G`;

        const kbdOnlyLyrics = document.getElementById('kbd-only-lyrics');
        if (kbdOnlyLyrics) kbdOnlyLyrics.textContent = isMac ? 'Cmd + Option + L' : 'Ctrl + Alt + L';

        const kbdGhostMode = document.getElementById('kbd-ghost-mode');
        if (kbdGhostMode) kbdGhostMode.textContent = isMac ? 'Cmd + Option + G' : 'Ctrl + Alt + G';

        const kbdResync = document.getElementById('kbd-resync');
        if (kbdResync) kbdResync.textContent = isMac ? 'Cmd + R' : 'Ctrl + R';

        if (textForceResync) {
            textForceResync.textContent = `Sinkronkan Ulang Sekarang (${resyncShortcut})`;
        }
        if (btnOnlyLyrics) btnOnlyLyrics.title = `Mode Hanya Lirik (${modShortcut}+L)`;
        if (btnExitOnlyLyrics) btnExitOnlyLyrics.title = `Kembali ke Mode Normal (${modShortcut}+L)`;
        if (btnGhost) btnGhost.title = `Ghost Mode / Tembus Klik (${modShortcut}+G)`;
        if (btnResync) btnResync.title = `Sync Ulang Lirik & Waktu (${resyncShortcut})`;
        if (btnResyncPill) btnResyncPill.title = `Sync Ulang (${resyncShortcut})`;

        // Dynamic App Version from Electron
        if (window.electronAPI && window.electronAPI.getAppVersion) {
            window.electronAPI.getAppVersion().then((ver) => {
                if (ver) {
                    if (appVersionBadge) appVersionBadge.textContent = `v${ver}`;
                    if (updateCurrentVersion) updateCurrentVersion.textContent = `Versi ${ver}`;
                }
            }).catch(() => {});
        }

        try { setTheme(userTheme); } catch (e) { console.warn('setTheme error:', e); }
        try { if (userCustomAccent) setCustomAccentColor(userCustomAccent); } catch (e) {}
        try { setTextColorMode(userTextColorMode); } catch (e) {}
        try { if (userCustomTextColor) setCustomTextColor(userCustomTextColor); } catch (e) {}
        try { setInactiveTextColor(userInactiveColor); } catch (e) {}
        try { setBgStyle(userBgStyle); } catch (e) {}
        try { setCustomBgColor(userCustomBgColor); } catch (e) {}
        try { setSolidColor(userSolidColor); } catch (e) {}
        try { setGradientIndex(userGradientIndex); } catch (e) {}
        try { setWindowBlur(userWindowBlur); } catch (e) {}
        try { setFontFamily(userFontFamily); } catch (e) {}
        try { setFontSize(userFontSize); } catch (e) {}
        try { setFontWeight(userFontWeight); } catch (e) {}
        try { setFontStyle(userFontStyle); } catch (e) {}
        try { setTextGlow(userTextGlow); } catch (e) {}
        try { setTextStroke(userTextStroke); } catch (e) {}
        try { setTextAlign(userAlign); } catch (e) {}
        try { setInactiveOpacity(userInactiveOpacity); } catch (e) {}
        try { setMode(isCompactMode); } catch (e) {}
        try { setOnlyLyricsMode(isOnlyLyricsMode); } catch (e) {}

        if (fontPillLabel && userFontFamily) {
            fontPillLabel.textContent = fontLabels[userFontFamily] || (userFontFamily.charAt(0).toUpperCase() + userFontFamily.slice(1));
        }

        const savedOpacity = localStorage.getItem('window_opacity') || '85';
        if (opacitySlider) opacitySlider.value = savedOpacity;
        if (opacityVal) opacityVal.textContent = savedOpacity + '%';
        if (window.electronAPI) {
            window.electronAPI.setWindowOpacity(parseInt(savedOpacity, 10) / 100);
        }

        try { updateOffsetDisplay(); } catch (e) {}

        if (toggleAutoHide) toggleAutoHide.checked = autoHideControls;
        if (appContainer) appContainer.classList.toggle('autohide-active', autoHideControls);

        if (toggleAmbient) toggleAmbient.checked = ambientGlowEnabled;
        if (ambientBackdrop) ambientBackdrop.classList.toggle('disabled', !ambientGlowEnabled);

        if (togglePinSetting) togglePinSetting.checked = isAlwaysOnTop;
        try { setPlayerPanelCollapsed(isPlayerPanelCollapsed); } catch (e) {}
    } catch (err) {
        console.error('[Preferences Error]:', err);
    }
}

// Startup Splash Screen Animation Controller
const appStartTime = Date.now();
let splashDismissed = false;

function dismissSplashScreen(customMessage) {
    if (splashDismissed || !splashScreen) return;
    splashDismissed = true;

    if (customMessage && splashStatusText) {
        splashStatusText.textContent = customMessage;
    }

    const elapsed = Date.now() - appStartTime;
    const minSplashDuration = 1200; // minimum display time so user enjoys the logo & wave animation
    const remainingTime = Math.max(0, minSplashDuration - elapsed);

    setTimeout(() => {
        splashScreen.classList.add('splash-hide');
        setTimeout(() => {
            splashScreen.style.display = 'none';
        }, 550);
    }, remainingTime);
}

// Fallback auto-dismissal after 1.8s
setTimeout(() => {
    dismissSplashScreen('Siap menyanyikan lagu favoritmu...');
}, 1800);

// Format Seconds -> mm:ss (Always 2-digit padded)
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

// Update Header Track Artwork Avatar
function updateHeaderAvatar(artworkUrl) {
    if (!headerAvatarImg || !headerAvatarFallback) return;
    if (artworkUrl) {
        headerAvatarImg.src = artworkUrl;
        headerAvatarImg.classList.remove('hidden');
        headerAvatarFallback.classList.add('hidden');
    } else {
        headerAvatarImg.classList.add('hidden');
        headerAvatarImg.src = '';
        headerAvatarFallback.classList.remove('hidden');
    }
}

// Media State Update from Electron IPC
if (window.electronAPI) {
    window.electronAPI.onMediaUpdate((data) => {
        if (!data || !data.active) {
            dismissSplashScreen('Menunggu pemutar musik...');
            updateHeaderAvatar('');
            connectionDot.classList.remove('connected');
            if (playbackStatusText) playbackStatusText.textContent = 'Standby';
            if (liveEq) liveEq.classList.add('hidden');
            playbackBadge.classList.remove('playing');
            trackHeaderTicker.textContent = 'Spotify tidak aktif';
            isPlaying = false;
            updatePlayPauseButton();
            return;
        }

        dismissSplashScreen(`Terhubung: ${data.title || 'Musik'}`);
        connectionDot.classList.add('connected');
        const previousStatus = isPlaying;
        const previousTitle = currentMedia ? currentMedia.title : '';

        currentMedia = data;

        const titleText = data.title || 'Lagu Tanpa Judul';
        const artistText = data.artist || (data.album ? data.album : 'Spotify');
        trackNameEl.textContent = titleText;
        artistNameEl.textContent = artistText;
        trackHeaderTicker.textContent = `${titleText} — ${artistText}`;

        // Trigger marquee check for long titles and artists
        updateMarquee(trackNameEl);
        updateMarquee(artistNameEl);

        if (data.artworkUrl && (!currentLyrics || !currentLyrics.artwork)) {
            updateHeaderAvatar(data.artworkUrl);
        }

        isPlaying = (data.status === 'Playing');
        if (playbackStatusText) playbackStatusText.textContent = isPlaying ? 'Playing' : 'Paused';
        if (liveEq) liveEq.classList.toggle('hidden', !isPlaying);
        playbackBadge.classList.toggle('playing', isPlaying);
        updatePlayPauseButton();

        const reportedPos = (typeof data.position === 'number') ? data.position : 0;
        const currentEstimated = previousStatus ? (lastKnownPosition + (Date.now() - lastKnownTime) / 1000) : lastKnownPosition;
        const drift = Math.abs(currentEstimated - reportedPos);

        // Calibrate position anchor if drift > 0.35s, track changed, or playback status toggled
        if (drift > 0.35 || previousStatus !== isPlaying || previousTitle !== data.title) {
            lastKnownPosition = reportedPos;
            lastKnownTime = Date.now();
        }

        const currentTrackIdentifier = `${titleText} - ${artistText}`.toLowerCase();
        if (previousTitle !== data.title && data.title) {
            const hasMatchingLyrics = currentLyrics && (currentTrackKey === currentTrackIdentifier || currentLyrics.title === data.title) && currentLyrics.lines && currentLyrics.lines.length > 0;
            if (!hasMatchingLyrics) {
                currentTrackKey = '';
                renderLyrics({ loading: true, message: `Memuat lirik: ${data.title}...` });
            }
        }

        if (data.duration > 0) {
            totalDurationEl.textContent = formatTime(data.duration);
        }
    });

    window.electronAPI.onLyricsLoaded((payload) => {
        if (!payload) return;
        const trackKey = payload.trackKey || '';
        const lyrics = payload.lyrics || payload;
        currentTrackKey = trackKey;
        currentLyrics = lyrics;
        activeLineIndex = -1;

        if (lyrics && lyrics.artwork) {
            trackCoverArt.src = lyrics.artwork;
            trackCoverArt.classList.remove('hidden');
            coverPlaceholder.classList.add('hidden');
            updateHeaderAvatar(lyrics.artwork);
            ambientBackdrop.style.backgroundImage = `url('${lyrics.artwork}')`;
        } else {
            trackCoverArt.classList.add('hidden');
            coverPlaceholder.classList.remove('hidden');
            if (currentMedia && currentMedia.artworkUrl) {
                updateHeaderAvatar(currentMedia.artworkUrl);
            } else {
                updateHeaderAvatar('');
            }
            ambientBackdrop.style.backgroundImage = 'none';
        }

        renderLyrics(lyrics);
    });

    window.electronAPI.onClickThroughChanged((enabled) => {
        if (ghostBadge) ghostBadge.classList.toggle('hidden', !enabled);
        if (btnGhost) btnGhost.classList.toggle('active', enabled);
        if (toggleGhostSetting) toggleGhostSetting.checked = enabled;
    });

    // Shortcut Ctrl+Alt+L for Only Lyrics
    window.electronAPI.onToggleOnlyLyricsShortcut(() => {
        setOnlyLyricsMode(!isOnlyLyricsMode);
    });

    // Auto-Updater status listener
    window.electronAPI.onUpdateStatus((status) => {
        handleUpdateStatus(status);
    });
}

function updatePlayPauseButton() {
    if (isPlaying) {
        playIcon.classList.add('hidden');
        pauseIcon.classList.remove('hidden');
    } else {
        playIcon.classList.remove('hidden');
        pauseIcon.classList.add('hidden');
    }
}

// Render lyrics to flow container
function renderLyrics(lyrics) {
    lyricsContainer.innerHTML = '';

    if (!lyrics || !lyrics.lines || lyrics.lines.length === 0) {
        lyricsContainer.classList.add('has-placeholder');
        if (lyricsViewport) lyricsViewport.classList.add('has-placeholder');
        const isLoading = lyrics && lyrics.loading;
        lyricsContainer.innerHTML = `
            <div class="stage-placeholder">
                <div class="music-bars-anim">
                    <span></span><span></span><span></span><span></span>
                </div>
                <p class="placeholder-text">${lyrics && lyrics.message ? lyrics.message : 'Lirik belum tersedia untuk lagu ini.'}</p>
                ${!isLoading ? `
                <button class="btn-placeholder-retry" id="btn-placeholder-retry">
                    <i class="ph-bold ph-arrows-clockwise"></i>
                    <span>Cari Ulang Lirik (${resyncShortcut})</span>
                </button>` : ''}
            </div>
        `;
        const retryBtn = document.getElementById('btn-placeholder-retry');
        if (retryBtn) retryBtn.addEventListener('click', triggerResync);
        return;
    }

    lyricsContainer.classList.remove('has-placeholder');
    if (lyricsViewport) lyricsViewport.classList.remove('has-placeholder');

    const fragment = document.createDocumentFragment();

    lyrics.lines.forEach((line, index) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        div.id = `line-${index}`;
        div.textContent = line.text || '•••';

        div.addEventListener('click', () => {
            div.classList.add('ripple-flash');
            setTimeout(() => div.classList.remove('ripple-flash'), 450);
            if (lyrics.hasSynced && window.electronAPI) {
                const targetSec = Math.max(0, line.time - 0.05);
                window.electronAPI.controlMedia('seek', { position: targetSec });
                lastKnownPosition = targetSec;
                lastKnownTime = Date.now();
                updateActiveLine(index);
            }
        });

        fragment.appendChild(div);
    });

    lyricsContainer.appendChild(fragment);
}

// High-Frequency Continuous Synchronization Loop (~30 FPS)
function syncLoop() {
    if (currentMedia && currentMedia.duration > 0) {
        let currentPos = lastKnownPosition;
        if (isPlaying) {
            currentPos += (Date.now() - lastKnownTime) / 1000;
        }

        const lyricSyncTime = currentPos + userOffset;

        const progressPercent = Math.min(100, Math.max(0, (currentPos / currentMedia.duration) * 100));
        scrubberProgress.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(currentPos);
        if (currentMedia.duration > 0) {
            if (showRemainingDuration) {
                const remaining = Math.max(0, currentMedia.duration - currentPos);
                totalDurationEl.textContent = `-${formatTime(remaining)}`;
            } else {
                totalDurationEl.textContent = formatTime(currentMedia.duration);
            }
        }

        if (currentLyrics && currentLyrics.hasSynced && currentLyrics.lines.length > 0) {
            let foundIdx = -1;
            const lines = currentLyrics.lines;

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].time <= lyricSyncTime) {
                    foundIdx = i;
                } else {
                    break;
                }
            }

            if (foundIdx !== activeLineIndex && foundIdx >= 0) {
                updateActiveLine(foundIdx);
            }
        }
    }
}

// Continuous non-throttled interval
setInterval(syncLoop, 35);

// Scroll active lyric line into center of viewport reliably across all modes
function centerActiveLineInViewport(behavior = 'smooth') {
    if (activeLineIndex < 0) return;
    const activeEl = document.getElementById(`line-${activeLineIndex}`);
    if (!activeEl || !lyricsViewport) return;

    const viewportHeight = lyricsViewport.clientHeight;
    if (viewportHeight <= 0) return;

    const activeTop = activeEl.offsetTop;
    const activeHeight = activeEl.offsetHeight;
    const targetScrollTop = activeTop - (viewportHeight / 2) + (activeHeight / 2);

    try {
        lyricsViewport.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: behavior
        });
    } catch (e) {
        lyricsViewport.scrollTop = Math.max(0, targetScrollTop);
    }
}

// Highlight and center-scroll
function updateActiveLine(newIdx) {
    if (activeLineIndex >= 0) {
        const oldEl = document.getElementById(`line-${activeLineIndex}`);
        if (oldEl) oldEl.classList.remove('active', 'near');
        const prevEl = document.getElementById(`line-${activeLineIndex - 1}`);
        if (prevEl) prevEl.classList.remove('near');
        const nextEl = document.getElementById(`line-${activeLineIndex + 1}`);
        if (nextEl) nextEl.classList.remove('near');
    }

    activeLineIndex = newIdx;
    const newEl = document.getElementById(`line-${newIdx}`);
    if (newEl) {
        newEl.classList.add('active');

        const prevEl = document.getElementById(`line-${newIdx - 1}`);
        if (prevEl) prevEl.classList.add('near');
        const nextEl = document.getElementById(`line-${newIdx + 1}`);
        if (nextEl) nextEl.classList.add('near');

        centerActiveLineInViewport('smooth');
    }
}

// Scrubber Hover Tooltip (Attached directly to track for pixel-perfect timing)
const activeScrubberTrack = scrubberTrack || scrubberContainer;
if (activeScrubberTrack && scrubberTooltip) {
    activeScrubberTrack.addEventListener('mousemove', (e) => {
        if (!currentMedia || !currentMedia.duration) return;
        const rect = activeScrubberTrack.getBoundingClientRect();
        if (rect.width <= 0) return;
        const hoverX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percent = hoverX / rect.width;
        const hoverTime = percent * currentMedia.duration;

        scrubberTooltip.textContent = formatTime(hoverTime);
        scrubberTooltip.style.left = `${hoverX}px`;
        scrubberTooltip.classList.remove('hidden');
    });

    activeScrubberTrack.addEventListener('mouseleave', () => {
        scrubberTooltip.classList.add('hidden');
    });
}

// Scrubber Click & Seek (Accurate from 0:00 to 100% of duration)
if (activeScrubberTrack) {
    activeScrubberTrack.addEventListener('click', (e) => {
        if (!currentMedia || !currentMedia.duration || !window.electronAPI) return;
        const rect = activeScrubberTrack.getBoundingClientRect();
        if (rect.width <= 0) return;
        const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const percent = Math.max(0, Math.min(1, clickX / rect.width));
        const targetSeconds = percent * currentMedia.duration;

        window.electronAPI.controlMedia('seek', { position: targetSeconds });
        lastKnownPosition = targetSeconds;
        lastKnownTime = Date.now();
        syncLoop();
    });
}

// Click Total Duration to toggle Remaining / Total Duration
if (totalDurationEl) {
    totalDurationEl.style.cursor = 'pointer';
    totalDurationEl.title = 'Klik untuk ganti durasi penuh / sisa waktu';
    totalDurationEl.addEventListener('click', () => {
        showRemainingDuration = !showRemainingDuration;
        localStorage.setItem('show_remaining_duration', showRemainingDuration);
        syncLoop();
    });
}

// Media Control Buttons
btnPlayPause.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.controlMedia('playpause');
});

btnPrev.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.controlMedia('previous');
});

btnNext.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.controlMedia('next');
});

// Always on Top Pin
if (btnPin) {
    btnPin.addEventListener('click', () => {
        isAlwaysOnTop = !isAlwaysOnTop;
        btnPin.classList.toggle('active', isAlwaysOnTop);
        if (togglePinSetting) togglePinSetting.checked = isAlwaysOnTop;
        if (window.electronAPI) window.electronAPI.setAlwaysOnTop(isAlwaysOnTop);
    });
}
if (togglePinSetting) {
    togglePinSetting.addEventListener('change', (e) => {
        isAlwaysOnTop = e.target.checked;
        if (btnPin) btnPin.classList.toggle('active', isAlwaysOnTop);
        if (window.electronAPI) window.electronAPI.setAlwaysOnTop(isAlwaysOnTop);
    });
}

// Ghost Mode
if (btnGhost) {
    btnGhost.addEventListener('click', () => {
        const isNowGhost = !btnGhost.classList.contains('active');
        if (window.electronAPI) window.electronAPI.setClickThrough(isNowGhost);
    });
}
if (toggleGhostSetting) {
    toggleGhostSetting.addEventListener('change', (e) => {
        if (window.electronAPI) window.electronAPI.setClickThrough(e.target.checked);
    });
}

// Resync / Sync Ulang Implementation
function triggerResync() {
    if (iconResyncHeader) {
        iconResyncHeader.classList.remove('spinning');
        void iconResyncHeader.offsetWidth;
        iconResyncHeader.classList.add('spinning');
    }
    if (iconResyncPill) {
        iconResyncPill.classList.remove('spinning');
        void iconResyncPill.offsetWidth;
        iconResyncPill.classList.add('spinning');
    }
    if (iconForceResync) {
        iconForceResync.classList.remove('spinning');
        void iconForceResync.offsetWidth;
        iconForceResync.classList.add('spinning');
    }

    if (btnForceResync && textForceResync) {
        btnForceResync.classList.add('active-feedback');
        textForceResync.textContent = 'Menyinkronkan...';
    }

    // Command bridge to force query SMTC
    if (window.electronAPI) {
        window.electronAPI.resyncMedia();
    }

    // Force instant lyric refresh
    activeLineIndex = -1;

    setTimeout(() => {
        if (iconResyncHeader) iconResyncHeader.classList.remove('spinning');
        if (iconResyncPill) iconResyncPill.classList.remove('spinning');
        if (iconForceResync) iconForceResync.classList.remove('spinning');
        if (btnForceResync && textForceResync) {
            textForceResync.textContent = 'Tersinkronisasi! ✓';
            setTimeout(() => {
                btnForceResync.classList.remove('active-feedback');
                textForceResync.textContent = `Sinkronkan Ulang Sekarang (${resyncShortcut})`;
            }, 1400);
        }
    }, 700);
}

if (btnResync) btnResync.addEventListener('click', triggerResync);
if (btnResyncPill) btnResyncPill.addEventListener('click', triggerResync);
if (btnForceResync) btnForceResync.addEventListener('click', triggerResync);

window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isTyping = activeTag === 'input' || activeTag === 'textarea';

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        triggerResync();
    } else if (e.code === 'Space' && !isTyping) {
        e.preventDefault();
        if (window.electronAPI) window.electronAPI.controlMedia('playpause');
    }
});

// Only Lyrics Mode Toggle
if (btnOnlyLyrics) {
    btnOnlyLyrics.addEventListener('click', () => {
        setOnlyLyricsMode(!isOnlyLyricsMode);
    });
}

if (btnExitOnlyLyrics) {
    btnExitOnlyLyrics.addEventListener('click', () => {
        setOnlyLyricsMode(false);
    });
}

if (toggleOnlyLyricsSetting) {
    toggleOnlyLyricsSetting.addEventListener('change', (e) => {
        setOnlyLyricsMode(e.target.checked);
    });
}

function setOnlyLyricsMode(enabled) {
    isOnlyLyricsMode = enabled;
    localStorage.setItem('only_lyrics_mode', enabled);
    if (btnOnlyLyrics) btnOnlyLyrics.classList.toggle('active', enabled);
    if (toggleOnlyLyricsSetting) toggleOnlyLyricsSetting.checked = enabled;

    // Update dock karaoke toggle button
    if (btnLyricsToggle) {
        btnLyricsToggle.classList.toggle('active', enabled);
    }
    if (iconKaraokeDock) {
        iconKaraokeDock.className = enabled ? 'ph-fill ph-microphone' : 'ph-bold ph-microphone';
    }

    appContainer.classList.toggle('mode-only-lyrics', enabled);
    if (onlyLyricsExitPill) onlyLyricsExitPill.classList.toggle('hidden', !enabled);
    if (normalWindowActions) normalWindowActions.classList.toggle('hidden', enabled);

    // Toggle visibility of three dots button in only-lyrics mode
    if (btnThreeDotsLyrics) {
        btnThreeDotsLyrics.classList.toggle('hidden', !enabled);
    }

    // Update Dropdown Menu Item label & icon
    if (dropdownTextLyrics) {
        dropdownTextLyrics.textContent = enabled ? 'Kembali ke Mode Normal' : 'Mode Hanya Lirik';
    }
    if (dropdownIconLyrics) {
        dropdownIconLyrics.className = enabled ? 'ph-bold ph-arrows-out-simple' : 'ph-bold ph-microphone';
    }

    // Close any open dropdown menu
    if (quickDropdownMenu) quickDropdownMenu.classList.add('hidden');

    if (enabled) {
        if (window.electronAPI) window.electronAPI.resizeWindow(380, 120);
    } else {
        if (window.electronAPI) {
            window.electronAPI.resizeWindow(520, 140);
            window.electronAPI.setAlwaysOnTop(isAlwaysOnTop);
        }
        if (trackHeaderCard) {
            trackHeaderCard.classList.remove('collapsed');
        }
        setTimeout(() => {
            updateMarquee(trackNameEl);
            updateMarquee(artistNameEl);
        }, 150);
    }

    // Re-center active lyric line immediately after layout/resize settles
    setTimeout(() => {
        centerActiveLineInViewport('auto');
        syncLoop();
    }, 60);
    setTimeout(() => {
        centerActiveLineInViewport('smooth');
    }, 180);
}

// Quick Three-Dots Dropdown Interaction (Anti-Cutoff Positioning)
function toggleQuickDropdown(anchorBtn) {
    if (!quickDropdownMenu || !anchorBtn) return;
    const isCurrentlyOpen = !quickDropdownMenu.classList.contains('hidden');
    if (isCurrentlyOpen) {
        quickDropdownMenu.classList.add('hidden');
        return;
    }

    // Render offscreen/hidden momentarily to measure exact dimensions
    quickDropdownMenu.style.visibility = 'hidden';
    quickDropdownMenu.classList.remove('hidden');

    const containerRect = appContainer.getBoundingClientRect();
    const btnRect = anchorBtn.getBoundingClientRect();
    const menuHeight = quickDropdownMenu.offsetHeight || 108;
    const menuWidth = quickDropdownMenu.offsetWidth || 168;
    const pad = 6; // Minimum distance from window outer boundary

    if (anchorBtn === btnThreeDotsPlayer) {
        // Horizontal: Align with button left, clamped to window bounds
        let leftOffset = btnRect.left - containerRect.left;
        if (leftOffset + menuWidth > containerRect.width - pad) {
            leftOffset = containerRect.width - menuWidth - pad;
        }
        if (leftOffset < pad) leftOffset = pad;

        quickDropdownMenu.style.left = `${leftOffset}px`;
        quickDropdownMenu.style.right = 'auto';

        // Vertical: Check if placing above button clips top (140px window)
        const spaceAbove = btnRect.top - containerRect.top;
        if (menuHeight + 8 > spaceAbove) {
            // Pin to top with safe margin so "Pengaturan" is always 100% visible
            quickDropdownMenu.style.top = `${pad}px`;
            quickDropdownMenu.style.bottom = 'auto';
        } else {
            const bottomOffset = containerRect.bottom - btnRect.top + 4;
            quickDropdownMenu.style.top = 'auto';
            quickDropdownMenu.style.bottom = `${bottomOffset}px`;
        }
    } else {
        // btnThreeDotsLyrics (Floating button in Only-Lyrics Mode)
        let rightOffset = containerRect.right - btnRect.right;
        if (rightOffset + menuWidth > containerRect.width - pad) {
            rightOffset = containerRect.width - menuWidth - pad;
        }
        if (rightOffset < pad) rightOffset = pad;

        quickDropdownMenu.style.right = `${rightOffset}px`;
        quickDropdownMenu.style.left = 'auto';

        // Vertical: Check if placing below button clips bottom (120px window)
        const idealTop = btnRect.bottom - containerRect.top + 4;
        if (idealTop + menuHeight > containerRect.height - pad) {
            quickDropdownMenu.style.top = 'auto';
            quickDropdownMenu.style.bottom = `${pad}px`;
        } else {
            quickDropdownMenu.style.top = `${idealTop}px`;
            quickDropdownMenu.style.bottom = 'auto';
        }
    }

    // Make visible and trigger animation
    quickDropdownMenu.style.visibility = 'visible';
}

if (btnThreeDotsPlayer) {
    btnThreeDotsPlayer.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQuickDropdown(btnThreeDotsPlayer);
    });
}

if (btnThreeDotsLyrics) {
    btnThreeDotsLyrics.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQuickDropdown(btnThreeDotsLyrics);
    });
}

if (btnLyricsToggle) {
    btnLyricsToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        setOnlyLyricsMode(!isOnlyLyricsMode);
    });
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    if (!quickDropdownMenu || quickDropdownMenu.classList.contains('hidden')) return;
    if (!quickDropdownMenu.contains(e.target) && !e.target.closest('#btn-three-dots-player') && !e.target.closest('#btn-three-dots-lyrics')) {
        quickDropdownMenu.classList.add('hidden');
    }
});

// Dropdown item actions
if (dropdownItemSettings) {
    dropdownItemSettings.addEventListener('click', () => {
        if (quickDropdownMenu) quickDropdownMenu.classList.add('hidden');
        if (settingsPanel) settingsPanel.classList.remove('hidden');
    });
}

if (dropdownItemResync) {
    dropdownItemResync.addEventListener('click', () => {
        if (quickDropdownMenu) quickDropdownMenu.classList.add('hidden');
        triggerResync();
    });
}

if (dropdownItemToggleLyrics) {
    dropdownItemToggleLyrics.addEventListener('click', () => {
        if (quickDropdownMenu) quickDropdownMenu.classList.add('hidden');
        setOnlyLyricsMode(!isOnlyLyricsMode);
    });
}

if (dropdownItemMinimize) {
    dropdownItemMinimize.addEventListener('click', () => {
        if (quickDropdownMenu) quickDropdownMenu.classList.add('hidden');
        if (window.electronAPI) window.electronAPI.minimizeWindow();
    });
}

if (dropdownItemClose) {
    dropdownItemClose.addEventListener('click', () => {
        if (quickDropdownMenu) quickDropdownMenu.classList.add('hidden');
        if (window.electronAPI) window.electronAPI.closeWindow();
    });
}

if (btnCloseOnlyLyrics) {
    btnCloseOnlyLyrics.addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.closeWindow();
    });
}

// Compact vs Card Mode
btnCompact.addEventListener('click', () => {
    setMode(!isCompactMode);
});

function setMode(compact) {
    isCompactMode = compact;
    localStorage.setItem('is_compact_mode', compact);
    const compactIcon = document.getElementById('icon-compact-expand');
    if (compact) {
        appContainer.classList.add('mode-compact');
        appContainer.classList.remove('mode-card');
        if (compactIcon) {
            compactIcon.className = 'ph-bold ph-arrows-out-simple';
        }
        if (!isOnlyLyricsMode && window.electronAPI) window.electronAPI.resizeWindow(440, 160);
    } else {
        appContainer.classList.remove('mode-compact');
        appContainer.classList.add('mode-card');
        if (compactIcon) {
            compactIcon.className = 'ph-bold ph-arrows-in-simple';
        }
        if (!isOnlyLyricsMode && window.electronAPI) window.electronAPI.resizeWindow(520, 140);
    }
    setTimeout(() => centerActiveLineInViewport('auto'), 60);
}

// Settings Modal & Tabs
let savedOpacityBeforeSettings = null;

function openSettings() {
    settingsPanel.classList.remove('hidden');

    // Expand window smoothly for comfortable settings layout
    if (window.electronAPI) {
        window.electronAPI.resizeWindow(480, 390);
    }

    const scrollContainer = document.querySelector('.settings-body-scroll');
    if (scrollContainer) scrollContainer.scrollTop = 0;
}

function closeSettings() {
    settingsPanel.classList.add('hidden');

    // Restore active mode window size
    if (window.electronAPI) {
        if (isOnlyLyricsMode) {
            window.electronAPI.resizeWindow(380, 120);
        } else {
            window.electronAPI.resizeWindow(520, 140);
        }
    }

    // Force WebKit compositor invalidation so headers & controls repaint properly
    requestAnimationFrame(() => {
        const dragH = document.getElementById('drag-header');
        if (dragH) {
            dragH.style.display = 'none';
            dragH.offsetHeight; // trigger reflow
            dragH.style.display = '';
        }
        if (appContainer) {
            appContainer.offsetHeight;
        }
    });

    setTimeout(() => centerActiveLineInViewport('auto'), 60);
}

// Robust mouse hover tracking to guarantee header visibility across all modes
if (appContainer) {
    appContainer.addEventListener('mouseenter', () => {
        appContainer.classList.add('is-hovered');
    });
    appContainer.addEventListener('mousemove', () => {
        if (!appContainer.classList.contains('is-hovered')) {
            appContainer.classList.add('is-hovered');
        }
    });
    appContainer.addEventListener('mouseleave', () => {
        appContainer.classList.remove('is-hovered');
    });
}

btnSettings.addEventListener('click', () => {
    if (settingsPanel.classList.contains('hidden')) {
        openSettings();
    } else {
        closeSettings();
    }
});

btnSettingsPill.addEventListener('click', openSettings);
btnCloseSettings.addEventListener('click', closeSettings);

// ESC key to close settings modal
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsPanel.classList.contains('hidden')) {
        closeSettings();
    }
});

tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
        const scrollContainer = document.querySelector('.settings-body-scroll');
        if (scrollContainer) scrollContainer.scrollTop = 0;
    });
});

// Opacity Slider
opacitySlider.addEventListener('input', (e) => {
    const val = e.target.value;
    opacityVal.textContent = val + '%';
    localStorage.setItem('window_opacity', val);
    savedOpacityBeforeSettings = parseInt(val, 10);
});

// Theme Selector
themeChips.forEach(chip => {
    chip.addEventListener('click', () => {
        userCustomAccent = '';
        localStorage.removeItem('lyric_custom_accent');
        setTheme(chip.dataset.theme);
        if (accentHexVal) accentHexVal.textContent = chip.dataset.color || '#1ed760';
        if (userTextColorMode === 'accent' && !userCustomTextColor) {
            if (textColorHexVal) textColorHexVal.textContent = chip.dataset.color || '#1ed760';
        }
    });
});

function setTheme(theme) {
    userTheme = theme;
    localStorage.setItem('lyric_theme', theme);
    themeChips.forEach(c => c.classList.toggle('active', c.dataset.theme === theme));
    bodyEl.classList.remove('theme-spotify', 'theme-purple', 'theme-cyan', 'theme-amber', 'theme-rose', 'theme-frost');
    bodyEl.classList.add(`theme-${theme}`);
    document.documentElement.style.removeProperty('--accent-color');
    document.documentElement.style.removeProperty('--accent-glow');
}

// Custom Accent Color
if (customAccentColor) {
    customAccentColor.addEventListener('input', (e) => {
        setCustomAccentColor(e.target.value);
    });
}

function setCustomAccentColor(hex) {
    if (!hex) return;
    userCustomAccent = hex;
    localStorage.setItem('lyric_custom_accent', hex);
    themeChips.forEach(c => c.classList.remove('active'));
    document.documentElement.style.setProperty('--accent-color', hex);
    document.documentElement.style.setProperty('--accent-glow', `${hex}77`);
    if (accentHexVal) accentHexVal.textContent = hex;
    if (customAccentColor) customAccentColor.value = hex;
    if (userTextColorMode === 'accent' && !userCustomTextColor) {
        if (textColorHexVal) textColorHexVal.textContent = hex;
    }
}

// Active Text Color Presets & Custom Picker
textColorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        userCustomTextColor = '';
        localStorage.removeItem('lyric_custom_text_color');
        setTextColorMode(btn.dataset.textcolor);
    });
});

function setTextColorMode(mode) {
    userTextColorMode = mode || 'white';
    localStorage.setItem('lyric_text_color_mode', userTextColorMode);
    textColorBtns.forEach(b => b.classList.toggle('active', b.dataset.textcolor === userTextColorMode));
    bodyEl.classList.remove('textcolor-white', 'textcolor-accent', 'textcolor-gold', 'textcolor-cyan');
    bodyEl.classList.add(`textcolor-${userTextColorMode}`);
    document.documentElement.style.removeProperty('--lyric-active-color');

    const modeHexMap = {
        white: '#ffffff',
        accent: userCustomAccent || (accentHexVal ? accentHexVal.textContent : '#1ed760'),
        gold: '#fde047',
        cyan: '#67e8f9'
    };
    const resolvedHex = modeHexMap[userTextColorMode] || '#ffffff';
    if (textColorHexVal) textColorHexVal.textContent = resolvedHex;
    if (customTextColor && resolvedHex.startsWith('#')) customTextColor.value = resolvedHex;
}

if (customTextColor) {
    customTextColor.addEventListener('input', (e) => {
        setCustomTextColor(e.target.value);
    });
}

function setCustomTextColor(hex) {
    if (!hex) return;
    userCustomTextColor = hex;
    localStorage.setItem('lyric_custom_text_color', hex);
    textColorBtns.forEach(b => b.classList.remove('active'));
    document.documentElement.style.setProperty('--lyric-active-color', hex);
    if (textColorHexVal) textColorHexVal.textContent = hex;
    if (customTextColor) customTextColor.value = hex;
}

// Inactive Lyric Text Color Presets & Custom Picker
inactiveColorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setInactiveTextColor(btn.dataset.inactivecolor);
    });
});

if (customInactiveColor) {
    customInactiveColor.addEventListener('input', (e) => {
        setInactiveTextColor(e.target.value);
    });
}

function setInactiveTextColor(hex) {
    if (!hex) return;
    userInactiveColor = hex;
    localStorage.setItem('lyric_inactive_color', hex);
    inactiveColorBtns.forEach(b => b.classList.toggle('active', b.dataset.inactivecolor.toLowerCase() === hex.toLowerCase()));
    document.documentElement.style.setProperty('--lyric-inactive-color', hex);
    if (inactiveColorHexVal) inactiveColorHexVal.textContent = hex;
    if (customInactiveColor && hex.startsWith('#')) customInactiveColor.value = hex;
}

// Background Style Selector
bgStyleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setBgStyle(btn.dataset.bgstyle);
    });
});

function setBgStyle(style) {
    userBgStyle = style || 'liquid';
    localStorage.setItem('lyric_bg_style', userBgStyle);
    bgStyleBtns.forEach(b => b.classList.toggle('active', b.dataset.bgstyle === userBgStyle));

    bodyEl.classList.remove('bg-liquid', 'bg-solid', 'bg-gradient', 'bg-frosted', 'bg-obsidian', 'bg-minimal', 'bg-custom');
    bodyEl.classList.add(`bg-${userBgStyle}`);

    // Show/hide sub-option panels based on selected background mode
    if (rowBgSolidOptions) {
        rowBgSolidOptions.style.display = (userBgStyle === 'solid') ? 'flex' : 'none';
    }
    if (rowBgGradientOptions) {
        rowBgGradientOptions.style.display = (userBgStyle === 'gradient') ? 'flex' : 'none';
    }
}

// Solid Color Mode Presets & Custom Picker
function setSolidColor(hex) {
    if (!hex) return;
    userSolidColor = hex;
    localStorage.setItem('lyric_solid_color', hex);
    document.documentElement.style.setProperty('--active-solid-color', hex);
    if (solidColorHexVal) solidColorHexVal.textContent = hex;
    if (bgCustomSolidColor) bgCustomSolidColor.value = hex;

    solidPresetBtns.forEach(btn => {
        const btnHex = btn.dataset.solidcolor || btn.dataset.solid;
        btn.classList.toggle('active', btnHex && btnHex.toLowerCase() === hex.toLowerCase());
    });
}

solidPresetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.dataset.solidcolor || btn.dataset.solid;
        if (color) setSolidColor(color);
    });
});

if (bgCustomSolidColor) {
    bgCustomSolidColor.addEventListener('input', (e) => {
        setSolidColor(e.target.value);
    });
}

// Aesthetic Gradient Mode & Random Shuffler
function setGradientIndex(idx) {
    if (idx < 0 || idx >= aestheticGradients.length) idx = 0;
    userGradientIndex = idx;
    localStorage.setItem('lyric_gradient_index', idx);

    const grad = aestheticGradients[idx];
    document.documentElement.style.setProperty('--active-gradient-color', grad.css);
    if (gradientNameVal) gradientNameVal.textContent = grad.name;

    const chips = document.querySelectorAll('.gradient-chip');
    chips.forEach(chip => {
        const chipIdx = parseInt(chip.dataset.gradientIdx, 10);
        chip.classList.toggle('active', chipIdx === idx);
    });
}

function shuffleRandomGradient() {
    let nextIdx = Math.floor(Math.random() * aestheticGradients.length);
    if (nextIdx === userGradientIndex && aestheticGradients.length > 1) {
        nextIdx = (nextIdx + 1) % aestheticGradients.length;
    }
    setGradientIndex(nextIdx);

    if (btnRandomGradient) {
        btnRandomGradient.classList.remove('pulse');
        void btnRandomGradient.offsetWidth;
        btnRandomGradient.classList.add('pulse');
        setTimeout(() => btnRandomGradient.classList.remove('pulse'), 400);
    }
}

if (btnRandomGradient) {
    btnRandomGradient.addEventListener('click', shuffleRandomGradient);
}

// Wire pre-rendered gradient chips in index.html
document.querySelectorAll('.gradient-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const idx = parseInt(chip.dataset.gradientIdx, 10);
        if (!isNaN(idx)) setGradientIndex(idx);
    });
});

// Custom Tint Background Color
if (bgCustomColor) {
    bgCustomColor.addEventListener('input', (e) => {
        setCustomBgColor(e.target.value);
    });
}

function setCustomBgColor(hex) {
    userCustomBgColor = hex;
    localStorage.setItem('lyric_custom_bg_color', hex);
    if (bgColorHex) bgColorHex.textContent = hex;
    if (bgCustomColor) bgCustomColor.value = hex;
    // Apply semi-transparent glass tint
    document.documentElement.style.setProperty('--custom-bg-color', `${hex}88`);
}

// Glass Blur Intensity Slider
if (blurSlider) {
    blurSlider.addEventListener('input', (e) => {
        setWindowBlur(e.target.value);
    });
}

function setWindowBlur(val) {
    userWindowBlur = val;
    localStorage.setItem('lyric_window_blur', val);
    if (blurVal) blurVal.textContent = `${val}px`;
    if (blurSlider) blurSlider.value = val;
    document.documentElement.style.setProperty('--window-blur', `${val}px`);
}

// Font Family Selector
fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFontFamily(btn.dataset.font);
    });
});

if (btnFontPill) {
    btnFontPill.addEventListener('click', () => {
        const currentIndex = availableFonts.indexOf(userFontFamily);
        const nextIndex = (currentIndex + 1) % availableFonts.length;
        setFontFamily(availableFonts[nextIndex]);
    });
}

function setFontFamily(font) {
    userFontFamily = font;
    localStorage.setItem('lyric_font_family', font);
    fontBtns.forEach(b => b.classList.toggle('active', b.dataset.font === font));
    bodyEl.classList.remove('font-jakarta', 'font-inter', 'font-outfit', 'font-playfair', 'font-mono');
    bodyEl.classList.add(`font-${font}`);
    if (fontPillLabel) {
        fontPillLabel.textContent = fontLabels[font] || font;
    }
}

// Font Size Selector
segFontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFontSize(btn.dataset.size);
    });
});

function setFontSize(size) {
    userFontSize = size;
    localStorage.setItem('lyric_font_size', size);
    segFontBtns.forEach(b => b.classList.toggle('active', b.dataset.size === size));
    bodyEl.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge', 'font-jumbo');
    bodyEl.classList.add(`font-${size}`);
    setTimeout(() => centerActiveLineInViewport('auto'), 30);
}

// Font Weight Selector
weightBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFontWeight(btn.dataset.weight);
    });
});

function setFontWeight(weight) {
    userFontWeight = weight;
    localStorage.setItem('lyric_font_weight', weight);
    weightBtns.forEach(b => b.classList.toggle('active', b.dataset.weight === weight));
    bodyEl.classList.remove('weight-400', 'weight-600', 'weight-700', 'weight-800');
    bodyEl.classList.add(`weight-${weight}`);
}

// Font Style & Transform Selector
fstyleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setFontStyle(btn.dataset.fstyle);
    });
});

function setFontStyle(style) {
    userFontStyle = style || 'normal';
    localStorage.setItem('lyric_font_style', userFontStyle);
    fstyleBtns.forEach(b => b.classList.toggle('active', b.dataset.fstyle === userFontStyle));
    bodyEl.classList.remove('fstyle-normal', 'fstyle-italic', 'fstyle-uppercase', 'fstyle-capitalize');
    bodyEl.classList.add(`fstyle-${userFontStyle}`);
}

// Text Glow Selector
glowBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setTextGlow(btn.dataset.glow);
    });
});

function setTextGlow(glow) {
    userTextGlow = glow;
    localStorage.setItem('lyric_text_glow', glow);
    glowBtns.forEach(b => b.classList.toggle('active', b.dataset.glow === glow));
    bodyEl.classList.remove('glow-none', 'glow-soft', 'glow-strong');
    bodyEl.classList.add(`glow-${glow}`);
}

// Text Outline / Stroke Selector
strokeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setTextStroke(btn.dataset.stroke);
    });
});

function setTextStroke(stroke) {
    userTextStroke = stroke || 'none';
    localStorage.setItem('lyric_text_stroke', userTextStroke);
    strokeBtns.forEach(b => b.classList.toggle('active', b.dataset.stroke === userTextStroke));
    bodyEl.classList.remove('stroke-none', 'stroke-shadow', 'stroke-crisp');
    bodyEl.classList.add(`stroke-${userTextStroke}`);
}

// Text Alignment
alignBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        setTextAlign(btn.dataset.align);
    });
});

function setTextAlign(align) {
    userAlign = align;
    localStorage.setItem('lyric_align', align);
    alignBtns.forEach(b => b.classList.toggle('active', b.dataset.align === align));
    bodyEl.classList.remove('align-center', 'align-left', 'align-right');
    bodyEl.classList.add(`align-${align}`);
}

// Inactive Lyric Opacity Slider
if (inactiveOpacitySlider) {
    inactiveOpacitySlider.addEventListener('input', (e) => {
        setInactiveOpacity(e.target.value);
    });
}

function setInactiveOpacity(val) {
    userInactiveOpacity = val;
    localStorage.setItem('lyric_inactive_opacity', val);
    if (inactiveOpacityVal) inactiveOpacityVal.textContent = `${val}%`;
    if (inactiveOpacitySlider) inactiveOpacitySlider.value = val;
    document.documentElement.style.setProperty('--lyric-inactive-opacity', (parseInt(val, 10) / 100).toFixed(2));
}

// Offset Controls
let offsetToastTimer = null;
function showOffsetToast(msg) {
    let toast = document.getElementById('offset-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'offset-toast';
        toast.className = 'offset-toast';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span class="toast-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span><span>${msg}</span>`;
    toast.classList.add('show');
    if (offsetToastTimer) clearTimeout(offsetToastTimer);
    offsetToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 1200);
}

btnOffsetM5.addEventListener('click', () => adjustOffset(-0.5));
btnOffsetM1.addEventListener('click', () => adjustOffset(-0.1));
btnOffsetP1.addEventListener('click', () => adjustOffset(+0.1));
btnOffsetP5.addEventListener('click', () => adjustOffset(+0.5));
btnOffsetReset.addEventListener('click', () => setOffset(0));

function adjustOffset(delta) {
    setOffset(userOffset + delta, true);
}

function setOffset(val, notify = false) {
    userOffset = Math.round(val * 100) / 100;
    localStorage.setItem('lyric_offset', userOffset);
    updateOffsetDisplay();
    if (notify) {
        const sign = userOffset > 0 ? '+' : '';
        showOffsetToast(`Offset Lirik: ${sign}${userOffset.toFixed(2)}s`);
    }
}

function updateOffsetDisplay() {
    offsetValEl.textContent = (userOffset >= 0 ? '+' : '') + userOffset.toFixed(2) + 's';
}

// Global Keyboard Shortcuts for Offset Fine-tuning: [ (-0.5s), ] (+0.5s), \ (Reset)
window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
        return;
    }
    if (e.key === '[') {
        e.preventDefault();
        adjustOffset(-0.5);
    } else if (e.key === ']') {
        e.preventDefault();
        adjustOffset(+0.5);
    } else if (e.key === '\\') {
        e.preventDefault();
        setOffset(0, true);
    }
});

// Manual Lyrics Search
btnManualSearch.addEventListener('click', performManualSearch);
manualSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performManualSearch();
});

async function performManualSearch() {
    const query = manualSearchInput.value.trim();
    if (!query) return;

    manualSearchStatus.textContent = 'Mencari lirik...';
    try {
        if (window.electronAPI) {
            const result = await window.electronAPI.searchLyricsManual(query);
            if (result && result.lines && result.lines.length > 0) {
                currentLyrics = result;
                if (result.artwork) updateHeaderAvatar(result.artwork);
                renderLyrics(result);
                manualSearchStatus.textContent = `✓ Lirik ditemukan (${result.lines.length} baris)`;
                settingsPanel.classList.add('hidden');
            } else {
                manualSearchStatus.textContent = '✕ Lirik tidak ditemukan untuk pencarian tersebut.';
            }
        }
    } catch (e) {
        manualSearchStatus.textContent = '✕ Terjadi kesalahan saat mencari.';
    }
}

// Auto-Hide Controls Toggle
toggleAutoHide.addEventListener('change', (e) => {
    autoHideControls = e.target.checked;
    localStorage.setItem('autohide_controls', autoHideControls);
    appContainer.classList.toggle('autohide-active', autoHideControls);
});

// Ambient Glow Toggle
toggleAmbient.addEventListener('change', (e) => {
    ambientGlowEnabled = e.target.checked;
    localStorage.setItem('ambient_glow', ambientGlowEnabled);
    ambientBackdrop.classList.toggle('disabled', !ambientGlowEnabled);
});

// Auto-Updater UI Logic
btnCheckUpdates.addEventListener('click', async () => {
    updateStatusText.textContent = 'Memeriksa pembaruan ke server...';
    if (window.electronAPI) {
        const res = await window.electronAPI.checkForUpdates();
        handleUpdateStatus(res);
    }
});

btnDownloadUpdate.addEventListener('click', async () => {
    if (window.electronAPI) {
        btnDownloadUpdate.classList.add('hidden');
        updateProgressBar.classList.remove('hidden');
        await window.electronAPI.downloadUpdate();
    }
});

btnInstallUpdate.addEventListener('click', () => {
    if (window.electronAPI) {
        window.electronAPI.installUpdate();
    }
});

function handleUpdateStatus(status) {
    if (!status) return;

    if (status.version) {
        appVersionBadge.textContent = `v${status.version}`;
        updateCurrentVersion.textContent = `Versi ${status.version}`;
    }

    if (status.message) {
        updateStatusText.textContent = status.message;
    }

    if (status.state === 'available') {
        btnDownloadUpdate.classList.remove('hidden');
        btnInstallUpdate.classList.add('hidden');
        updateProgressBar.classList.add('hidden');
    } else if (status.state === 'downloading') {
        btnDownloadUpdate.classList.add('hidden');
        btnInstallUpdate.classList.add('hidden');
        updateProgressBar.classList.remove('hidden');
        updateProgressFill.style.width = `${status.progress || 0}%`;
    } else if (status.state === 'downloaded') {
        btnDownloadUpdate.classList.add('hidden');
        btnInstallUpdate.classList.remove('hidden');
        updateProgressBar.classList.add('hidden');
    } else {
        btnDownloadUpdate.classList.add('hidden');
        btnInstallUpdate.classList.add('hidden');
        updateProgressBar.classList.add('hidden');
    }
}

// Window minimize & close
if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.minimizeWindow();
    });
}

if (btnClose) {
    btnClose.addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.closeWindow();
    });
}

// Run preferences initialization now that everything is attached and defined
applySavedPreferences();

// Window resize listener to recalculate marquee on size changes
window.addEventListener('resize', () => {
    updateMarquee(trackNameEl);
    updateMarquee(artistNameEl);
});

// Initial marquee evaluation
setTimeout(() => {
    updateMarquee(trackNameEl);
    updateMarquee(artistNameEl);
}, 300);

