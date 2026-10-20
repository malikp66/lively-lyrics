/**
 * settings.js
 * Independent Floating Settings Window Controller for LivelyLyrics
 * Syncs changes instantly to the Miniplayer Window via BroadcastChannel & LocalStorage
 */

(function () {
    const broadcast = ('BroadcastChannel' in window) ? new BroadcastChannel('lively-lyrics-settings') : null;

    const KEY_MAP = {
        'bg_style': 'lyric_bg_style',
        'bg_solid_color': 'lyric_solid_color',
        'bg_gradient_idx': 'lyric_gradient_index',
        'glass_blur': 'lyric_window_blur',
        'font_family': 'lyric_font_family',
        'lively_theme': 'lyric_theme',
        'custom_accent_color': 'lyric_custom_accent',
        'active_text_color_mode': 'lyric_text_color_mode',
        'custom_active_text_color': 'lyric_custom_text_color',
        'inactive_text_color': 'lyric_inactive_color',
        'lyric_size': 'lyric_font_size',
        'font_weight': 'lyric_font_weight',
        'font_style': 'lyric_font_style',
        'glow_effect': 'lyric_text_glow',
        'text_stroke': 'lyric_text_stroke',
        'align_mode': 'lyric_align',
        'inactive_opacity': 'lyric_inactive_opacity',
        'lyrics_offset': 'lyric_offset',
        'auto_hide_controls': 'autohide_controls',
        'ambient_glow': 'ambient_glow',
        'always_on_top': 'always_on_top',
        'is_ghost_mode': 'is_ghost_mode',
        'window_opacity': 'window_opacity'
    };

    function notifyChange(key, value) {
        if (key && value !== undefined) {
            localStorage.setItem(key, value);
            if (KEY_MAP[key]) {
                localStorage.setItem(KEY_MAP[key], value);
            }
        }
        if (broadcast) {
            broadcast.postMessage({ type: 'settings-changed', key, value });
        }
        if (window.electronAPI && window.electronAPI.sendSettingChanged) {
            window.electronAPI.sendSettingChanged({ key, value });
        }
    }

    // Platform detection for shortcuts
    const isMac = (window.electronAPI && window.electronAPI.platform) 
        ? window.electronAPI.platform === 'darwin' 
        : navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const modShortcut = isMac ? 'Cmd + Option' : 'Ctrl + Alt';
    const resyncShortcut = isMac ? 'Cmd + R' : 'Ctrl + R';

    // Elements
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Appearance elements
    const bgStyleBtns = document.querySelectorAll('.bg-style-btn');
    const rowBgSolidOptions = document.getElementById('row-bg-solid-options');
    const rowBgGradientOptions = document.getElementById('row-bg-gradient-options');
    const solidPresetBtns = document.querySelectorAll('.solid-preset-btn');
    const bgCustomSolidColor = document.getElementById('bg-custom-solid-color');
    const solidColorHexVal = document.getElementById('solid-color-hex-val');
    const btnRandomGradient = document.getElementById('btn-random-gradient');
    const gradientChipsContainer = document.getElementById('gradient-chips-container');
    const gradientNameVal = document.getElementById('gradient-name-val');

    const opacitySlider = document.getElementById('opacity-slider');
    const opacityVal = document.getElementById('opacity-val');
    const blurSlider = document.getElementById('blur-slider');
    const blurVal = document.getElementById('blur-val');

    const fontBtns = document.querySelectorAll('.font-btn');
    const themeChips = document.querySelectorAll('.theme-chip');
    const customAccentColor = document.getElementById('custom-accent-color');
    const accentHexVal = document.getElementById('accent-hex-val');

    const textColorBtns = document.querySelectorAll('.text-color-btn');
    const customTextColor = document.getElementById('custom-text-color');
    const textColorHexVal = document.getElementById('text-color-hex-val');

    const inactiveColorBtns = document.querySelectorAll('.inactive-color-btn');
    const customInactiveColor = document.getElementById('custom-inactive-color');
    const inactiveColorHexVal = document.getElementById('inactive-color-hex-val');

    const segFontBtns = document.querySelectorAll('#font-size-control .seg-btn');
    const weightBtns = document.querySelectorAll('.weight-btn');
    const fstyleBtns = document.querySelectorAll('.fstyle-btn');
    const glowBtns = document.querySelectorAll('.glow-btn');
    const strokeBtns = document.querySelectorAll('.stroke-btn');
    const alignBtns = document.querySelectorAll('.align-btn');
    const inactiveOpacitySlider = document.getElementById('inactive-opacity-slider');
    const inactiveOpacityVal = document.getElementById('inactive-opacity-val');

    // Sync elements
    const btnForceResync = document.getElementById('btn-force-resync');
    const iconForceResync = document.getElementById('icon-force-resync');
    const textForceResync = document.getElementById('text-force-resync');
    const offsetValEl = document.getElementById('offset-val');
    const btnOffsetM5 = document.getElementById('btn-offset-m5');
    const btnOffsetM1 = document.getElementById('btn-offset-m1');
    const btnOffsetReset = document.getElementById('btn-offset-reset');
    const btnOffsetP1 = document.getElementById('btn-offset-p1');
    const btnOffsetP5 = document.getElementById('btn-offset-p5');
    const manualSearchInput = document.getElementById('manual-search-input');
    const btnManualSearch = document.getElementById('btn-manual-search');
    const manualSearchStatus = document.getElementById('manual-search-status');

    // Window elements
    const togglePinSetting = document.getElementById('toggle-pin-setting');
    const toggleGhostSetting = document.getElementById('toggle-ghost-setting');
    const toggleAutoHide = document.getElementById('toggle-autohide');
    const toggleAmbient = document.getElementById('toggle-ambient');
    const kbdOnlyLyrics = document.getElementById('kbd-only-lyrics');
    const kbdGhostMode = document.getElementById('kbd-ghost-mode');
    const kbdResync = document.getElementById('kbd-resync');

    // Updates elements
    const appVersionBadge = document.getElementById('app-version-badge');
    const updateCurrentVersion = document.getElementById('update-current-version');
    const btnCheckUpdates = document.getElementById('btn-check-updates');
    const btnDownloadUpdate = document.getElementById('btn-download-update');
    const btnInstallUpdate = document.getElementById('btn-install-update');
    const updateStatusText = document.getElementById('update-status-text');
    const updateProgressBar = document.getElementById('update-progress-bar');
    const updateProgressFill = document.getElementById('update-progress-fill');

    // Gradient Presets Catalog
    const GRADIENT_PRESETS = [
        { name: "Aurora Glow", css: "linear-gradient(135deg, #09203f 0%, #1e453e 50%, #14352a 100%)" },
        { name: "Neon Cyber", css: "linear-gradient(135deg, #120e38 0%, #1a2550 50%, #0d3b48 100%)" },
        { name: "Sunset Velvet", css: "linear-gradient(135deg, #2e1026 0%, #4a1936 50%, #662243 100%)" },
        { name: "Deep Ocean", css: "linear-gradient(135deg, #071b26 0%, #0d2b3a 50%, #143642 100%)" },
        { name: "Cosmic Purple", css: "linear-gradient(135deg, #190a2c 0%, #291244 50%, #3d1b5a 100%)" },
        { name: "Nordic Night", css: "linear-gradient(135deg, #101726 0%, #16243b 50%, #1e3352 100%)" },
        { name: "Emerald Mystic", css: "linear-gradient(135deg, #06241b 0%, #0b3b2c 50%, #145942 100%)" },
        { name: "Ruby Eclipse", css: "linear-gradient(135deg, #2b0b14 0%, #451222 50%, #63172f 100%)" },
        { name: "Midnight Sapphire", css: "linear-gradient(135deg, #081026 0%, #0f1d45 50%, #1a3375 100%)" },
        { name: "Tokyo Synth", css: "linear-gradient(135deg, #1b092b 0%, #291142 50%, #0c3342 100%)" },
        { name: "Golden Twilight", css: "linear-gradient(135deg, #2b1d06 0%, #47300c 50%, #6b4a18 100%)" },
        { name: "Charcoal Smoke", css: "linear-gradient(135deg, #12151b 0%, #1c212b 50%, #262d3a 100%)" }
    ];

    // Close Window Actions
    function closeWindow() {
        if (window.electronAPI && window.electronAPI.closeSettingsWindow) {
            window.electronAPI.closeSettingsWindow();
        } else if (window.electronAPI && window.electronAPI.closeWindow) {
            window.electronAPI.closeWindow();
        }
    }

    if (btnCloseSettings) {
        btnCloseSettings.addEventListener('click', (e) => {
            e.stopPropagation();
            closeWindow();
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeWindow();
        }
    });

    // Tab Switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = btn.dataset.tab;
            const content = document.getElementById(target);
            if (content) content.classList.add('active');
        });
    });

    // Load initial values from localStorage
    function initValues() {
        // Platform shortcut labels
        if (kbdOnlyLyrics) kbdOnlyLyrics.textContent = `${modShortcut} + L`;
        if (kbdGhostMode) kbdGhostMode.textContent = `${modShortcut} + G`;
        if (kbdResync) kbdResync.textContent = resyncShortcut;
        if (textForceResync) textForceResync.textContent = `Sinkronkan Ulang Sekarang (${resyncShortcut})`;

        // App Version
        if (window.electronAPI && window.electronAPI.getAppVersion) {
            Promise.resolve(window.electronAPI.getAppVersion()).then(v => {
                if (v) {
                    if (appVersionBadge) appVersionBadge.textContent = `v${v}`;
                    if (updateCurrentVersion) updateCurrentVersion.textContent = `Versi ${v}`;
                }
            }).catch(() => {});
        }

        // Background Style
        const savedBgStyle = localStorage.getItem('bg_style') || localStorage.getItem('lyric_bg_style') || 'liquid';
        bgStyleBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.bgstyle === savedBgStyle);
        });
        updateBgOptionPanels(savedBgStyle);

        // Solid Color
        const savedSolidColor = localStorage.getItem('bg_solid_color') || localStorage.getItem('lyric_solid_color') || '#05070c';
        if (bgCustomSolidColor) bgCustomSolidColor.value = savedSolidColor;
        if (solidColorHexVal) solidColorHexVal.textContent = savedSolidColor;
        solidPresetBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.solidcolor.toLowerCase() === savedSolidColor.toLowerCase());
        });

        // Gradient Index
        const savedGradIdx = parseInt(localStorage.getItem('bg_gradient_idx') || localStorage.getItem('lyric_gradient_index') || '0', 10);
        updateGradientChipsSelection(savedGradIdx);

        // Opacity & Blur
        const savedOpacity = localStorage.getItem('window_opacity') || '85';
        if (opacitySlider) opacitySlider.value = savedOpacity;
        if (opacityVal) opacityVal.textContent = `${savedOpacity}%`;

        const savedBlur = localStorage.getItem('glass_blur') || localStorage.getItem('lyric_window_blur') || '28';
        if (blurSlider) blurSlider.value = savedBlur;
        if (blurVal) blurVal.textContent = `${savedBlur}px`;

        // Font Family
        const savedFont = localStorage.getItem('font_family') || localStorage.getItem('lyric_font_family') || 'jakarta';
        fontBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.font === savedFont);
        });

        // Accent Theme
        const savedTheme = localStorage.getItem('lively_theme') || localStorage.getItem('lyric_theme') || 'spotify';
        const savedAccentColor = localStorage.getItem('custom_accent_color') || localStorage.getItem('lyric_custom_accent') || '#1ed760';
        if (customAccentColor) customAccentColor.value = savedAccentColor;
        if (accentHexVal) accentHexVal.textContent = savedAccentColor;
        themeChips.forEach(chip => {
            chip.classList.toggle('active', chip.dataset.theme === savedTheme);
        });

        // Active Text Color
        const savedTextColor = localStorage.getItem('active_text_color_mode') || localStorage.getItem('lyric_text_color_mode') || 'white';
        const savedCustomTextColor = localStorage.getItem('custom_active_text_color') || localStorage.getItem('lyric_custom_text_color') || '#ffffff';
        if (customTextColor) customTextColor.value = savedCustomTextColor;
        if (textColorHexVal) textColorHexVal.textContent = (savedTextColor === 'custom') ? savedCustomTextColor : savedTextColor;
        textColorBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.textcolor === savedTextColor);
        });

        // Inactive Text Color
        const savedInactiveColor = localStorage.getItem('inactive_text_color') || localStorage.getItem('lyric_inactive_color') || '#cbd5e1';
        if (customInactiveColor) customInactiveColor.value = savedInactiveColor;
        if (inactiveColorHexVal) inactiveColorHexVal.textContent = savedInactiveColor;
        inactiveColorBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.inactivecolor.toLowerCase() === savedInactiveColor.toLowerCase());
        });

        // Font Size
        const savedSize = localStorage.getItem('lyric_size') || localStorage.getItem('lyric_font_size') || 'medium';
        segFontBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === savedSize);
        });

        // Font Weight
        const savedWeight = localStorage.getItem('font_weight') || localStorage.getItem('lyric_font_weight') || '700';
        weightBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.weight === savedWeight);
        });

        // Font Style
        const savedFStyle = localStorage.getItem('font_style') || 'normal';
        fstyleBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.fstyle === savedFStyle);
        });

        // Glow
        const savedGlow = localStorage.getItem('glow_effect') || 'soft';
        glowBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.glow === savedGlow);
        });

        // Stroke
        const savedStroke = localStorage.getItem('text_stroke') || 'none';
        strokeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.stroke === savedStroke);
        });

        // Alignment
        const savedAlign = localStorage.getItem('align_mode') || 'center';
        alignBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === savedAlign);
        });

        // Inactive Opacity
        const savedInactiveOpacity = localStorage.getItem('inactive_opacity') || '35';
        if (inactiveOpacitySlider) inactiveOpacitySlider.value = savedInactiveOpacity;
        if (inactiveOpacityVal) inactiveOpacityVal.textContent = `${savedInactiveOpacity}%`;

        // Offset
        const savedOffset = localStorage.getItem('lyrics_offset') || '0';
        const offsetNum = parseFloat(savedOffset) || 0;
        if (offsetValEl) {
            offsetValEl.textContent = `${offsetNum > 0 ? '+' : ''}${offsetNum.toFixed(2)}s`;
        }

        // Window Toggles
        if (togglePinSetting) {
            togglePinSetting.checked = localStorage.getItem('always_on_top') !== 'false';
        }
        if (toggleGhostSetting) {
            toggleGhostSetting.checked = localStorage.getItem('is_ghost_mode') === 'true';
        }
        if (toggleAutoHide) {
            toggleAutoHide.checked = localStorage.getItem('auto_hide_controls') !== 'false';
        }
        if (toggleAmbient) {
            toggleAmbient.checked = localStorage.getItem('ambient_glow') !== 'false';
        }
    }

    function updateBgOptionPanels(style) {
        if (rowBgSolidOptions) {
            rowBgSolidOptions.style.display = (style === 'solid') ? 'flex' : 'none';
        }
        if (rowBgGradientOptions) {
            rowBgGradientOptions.style.display = (style === 'gradient') ? 'flex' : 'none';
        }
    }

    function updateGradientChipsSelection(idx) {
        const chips = document.querySelectorAll('.gradient-chip');
        chips.forEach((c, i) => {
            c.classList.toggle('active', i === idx);
        });
        if (gradientNameVal && GRADIENT_PRESETS[idx]) {
            gradientNameVal.textContent = GRADIENT_PRESETS[idx].name;
        }
    }

    // --- EVENT LISTENERS ---

    // Background Style
    bgStyleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            bgStyleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const style = btn.dataset.bgstyle;
            updateBgOptionPanels(style);
            notifyChange('bg_style', style);
        });
    });

    // Solid Presets
    solidPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            solidPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const color = btn.dataset.solidcolor;
            if (bgCustomSolidColor) bgCustomSolidColor.value = color;
            if (solidColorHexVal) solidColorHexVal.textContent = color;
            bgStyleBtns.forEach(b => b.classList.toggle('active', b.dataset.bgstyle === 'solid'));
            updateBgOptionPanels('solid');
            notifyChange('bg_style', 'solid');
            notifyChange('bg_solid_color', color);
        });
    });

    if (bgCustomSolidColor) {
        bgCustomSolidColor.addEventListener('input', (e) => {
            const color = e.target.value;
            solidPresetBtns.forEach(b => b.classList.remove('active'));
            if (solidColorHexVal) solidColorHexVal.textContent = color;
            bgStyleBtns.forEach(b => b.classList.toggle('active', b.dataset.bgstyle === 'solid'));
            updateBgOptionPanels('solid');
            notifyChange('bg_style', 'solid');
            notifyChange('bg_solid_color', color);
        });
    }

    // Gradient Presets & Shuffle
    const chips = document.querySelectorAll('.gradient-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            const idx = parseInt(chip.dataset.gradientIdx || '0', 10);
            updateGradientChipsSelection(idx);
            bgStyleBtns.forEach(b => b.classList.toggle('active', b.dataset.bgstyle === 'gradient'));
            updateBgOptionPanels('gradient');
            notifyChange('bg_style', 'gradient');
            notifyChange('bg_gradient_idx', idx);
        });
    });

    if (btnRandomGradient) {
        btnRandomGradient.addEventListener('click', () => {
            const randomIdx = Math.floor(Math.random() * GRADIENT_PRESETS.length);
            updateGradientChipsSelection(randomIdx);
            bgStyleBtns.forEach(b => b.classList.toggle('active', b.dataset.bgstyle === 'gradient'));
            updateBgOptionPanels('gradient');
            notifyChange('bg_style', 'gradient');
            notifyChange('bg_gradient_idx', randomIdx);
        });
    }

    // Window Opacity Slider
    if (opacitySlider) {
        opacitySlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (opacityVal) opacityVal.textContent = `${val}%`;
            notifyChange('window_opacity', val);
            if (window.electronAPI && window.electronAPI.setWindowOpacity) {
                window.electronAPI.setWindowOpacity(val / 100);
            }
        });
    }

    // Glass Blur Slider
    if (blurSlider) {
        blurSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (blurVal) blurVal.textContent = `${val}px`;
            notifyChange('glass_blur', val);
        });
    }

    // Font Family
    fontBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            fontBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('font_family', btn.dataset.font);
        });
    });

    // Theme Accent
    function applyAccentToSettings(color) {
        if (!color) return;
        document.documentElement.style.setProperty('--accent-color', color);
        document.documentElement.style.setProperty('--accent-glow', `${color}77`);
    }

    themeChips.forEach(chip => {
        chip.addEventListener('click', () => {
            themeChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const theme = chip.dataset.theme;
            const color = chip.dataset.color;
            if (customAccentColor) customAccentColor.value = color;
            if (accentHexVal) accentHexVal.textContent = color;
            applyAccentToSettings(color);
            notifyChange('lively_theme', theme);
            notifyChange('custom_accent_color', color);
        });
    });

    if (customAccentColor) {
        customAccentColor.addEventListener('input', (e) => {
            const color = e.target.value;
            themeChips.forEach(c => c.classList.remove('active'));
            if (accentHexVal) accentHexVal.textContent = color;
            applyAccentToSettings(color);
            notifyChange('lively_theme', 'custom');
            notifyChange('custom_accent_color', color);
        });
    }

    // Active Text Color
    textColorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            textColorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.textcolor;
            if (textColorHexVal) textColorHexVal.textContent = mode;
            notifyChange('custom_active_text_color', '');
            notifyChange('active_text_color_mode', mode);
        });
    });

    if (customTextColor) {
        customTextColor.addEventListener('input', (e) => {
            const color = e.target.value;
            textColorBtns.forEach(b => b.classList.remove('active'));
            if (textColorHexVal) textColorHexVal.textContent = color;
            notifyChange('active_text_color_mode', 'custom');
            notifyChange('custom_active_text_color', color);
        });
    }

    // Inactive Text Color
    inactiveColorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            inactiveColorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const color = btn.dataset.inactivecolor;
            if (customInactiveColor) customInactiveColor.value = color;
            if (inactiveColorHexVal) inactiveColorHexVal.textContent = color;
            notifyChange('inactive_text_color', color);
        });
    });

    if (customInactiveColor) {
        customInactiveColor.addEventListener('input', (e) => {
            const color = e.target.value;
            inactiveColorBtns.forEach(b => b.classList.remove('active'));
            if (inactiveColorHexVal) inactiveColorHexVal.textContent = color;
            notifyChange('inactive_text_color', color);
        });
    }

    // Font Size
    segFontBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            segFontBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('lyric_size', btn.dataset.size);
        });
    });

    // Font Weight
    weightBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            weightBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('font_weight', btn.dataset.weight);
        });
    });

    // Font Style
    fstyleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            fstyleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('font_style', btn.dataset.fstyle);
        });
    });

    // Glow Effect
    glowBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            glowBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('glow_effect', btn.dataset.glow);
        });
    });

    // Stroke Effect
    strokeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            strokeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('text_stroke', btn.dataset.stroke);
        });
    });

    // Alignment
    alignBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            alignBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            notifyChange('align_mode', btn.dataset.align);
        });
    });

    // Inactive Opacity Slider
    if (inactiveOpacitySlider) {
        inactiveOpacitySlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (inactiveOpacityVal) inactiveOpacityVal.textContent = `${val}%`;
            notifyChange('inactive_opacity', val);
        });
    }

    // Resync Button
    if (btnForceResync) {
        btnForceResync.addEventListener('click', () => {
            if (iconForceResync) {
                iconForceResync.classList.remove('spinning');
                void iconForceResync.offsetWidth;
                iconForceResync.classList.add('spinning');
            }
            if (textForceResync) textForceResync.textContent = 'Menyinkronkan...';

            if (window.electronAPI && window.electronAPI.resyncMedia) {
                window.electronAPI.resyncMedia();
            }

            setTimeout(() => {
                if (iconForceResync) iconForceResync.classList.remove('spinning');
                if (textForceResync) {
                    textForceResync.textContent = 'Tersinkronisasi! ✓';
                    setTimeout(() => {
                        textForceResync.textContent = `Sinkronkan Ulang Sekarang (${resyncShortcut})`;
                    }, 1400);
                }
            }, 700);
        });
    }

    // Offset Adjusters
    function adjustOffset(delta) {
        let cur = parseFloat(localStorage.getItem('lyrics_offset') || '0');
        cur += delta;
        if (Math.abs(cur) < 0.01) cur = 0;
        localStorage.setItem('lyrics_offset', cur.toFixed(2));
        if (offsetValEl) {
            offsetValEl.textContent = `${cur > 0 ? '+' : ''}${cur.toFixed(2)}s`;
        }
        notifyChange('lyrics_offset', cur.toFixed(2));
    }

    function resetOffset() {
        localStorage.setItem('lyrics_offset', '0');
        if (offsetValEl) offsetValEl.textContent = '0.00s';
        notifyChange('lyrics_offset', '0');
    }

    if (btnOffsetM5) btnOffsetM5.addEventListener('click', () => adjustOffset(-0.5));
    if (btnOffsetM1) btnOffsetM1.addEventListener('click', () => adjustOffset(-0.1));
    if (btnOffsetReset) btnOffsetReset.addEventListener('click', resetOffset);
    if (btnOffsetP1) btnOffsetP1.addEventListener('click', () => adjustOffset(0.1));
    if (btnOffsetP5) btnOffsetP5.addEventListener('click', () => adjustOffset(0.5));

    // Manual Search
    if (btnManualSearch && manualSearchInput) {
        btnManualSearch.addEventListener('click', () => {
            const query = manualSearchInput.value.trim();
            if (!query) return;
            if (manualSearchStatus) {
                manualSearchStatus.textContent = 'Mencari lirik...';
                manualSearchStatus.style.color = 'var(--text-sub)';
            }
            if (window.electronAPI && window.electronAPI.searchLyricsManual) {
                window.electronAPI.searchLyricsManual(query)
                    .then((result) => {
                        if (manualSearchStatus) {
                            manualSearchStatus.textContent = `Ditemukan: ${result.title || query}!`;
                            manualSearchStatus.style.color = 'var(--accent-color)';
                        }
                    })
                    .catch((err) => {
                        if (manualSearchStatus) {
                            manualSearchStatus.textContent = err || 'Tidak ada lirik ditemukan.';
                            manualSearchStatus.style.color = '#ef4444';
                        }
                    });
            }
        });

        manualSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                btnManualSearch.click();
            }
        });
    }

    // Window Behavior Toggles
    if (togglePinSetting) {
        togglePinSetting.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            notifyChange('always_on_top', enabled);
            if (window.electronAPI && window.electronAPI.setAlwaysOnTop) {
                window.electronAPI.setAlwaysOnTop(enabled);
            }
        });
    }

    if (toggleGhostSetting) {
        toggleGhostSetting.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            notifyChange('is_ghost_mode', enabled);
            if (window.electronAPI && window.electronAPI.setClickThrough) {
                window.electronAPI.setClickThrough(enabled);
            }
        });
    }

    if (toggleAutoHide) {
        toggleAutoHide.addEventListener('change', (e) => {
            notifyChange('auto_hide_controls', e.target.checked);
        });
    }

    if (toggleAmbient) {
        toggleAmbient.addEventListener('change', (e) => {
            notifyChange('ambient_glow', e.target.checked);
        });
    }

    // Auto-Updates
    if (btnCheckUpdates) {
        btnCheckUpdates.addEventListener('click', () => {
            if (updateStatusText) updateStatusText.textContent = 'Memeriksa pembaruan rilis terbaru...';
            if (btnDownloadUpdate) btnDownloadUpdate.classList.add('hidden');
            if (btnInstallUpdate) btnInstallUpdate.classList.add('hidden');
            if (updateProgressBar) updateProgressBar.classList.add('hidden');

            if (window.electronAPI && window.electronAPI.checkForUpdates) {
                window.electronAPI.checkForUpdates()
                    .then((info) => {
                        const isAvail = info && (info.updateAvailable || info.state === 'available' || (info.newVersion && info.newVersion !== info.version));
                        if (isAvail) {
                            const newVer = info.newVersion || info.version;
                            if (updateStatusText) updateStatusText.textContent = `Versi baru tersedia: v${newVer}!`;
                            if (btnDownloadUpdate) btnDownloadUpdate.classList.remove('hidden');
                            if (btnInstallUpdate) btnInstallUpdate.classList.add('hidden');
                        } else if (info && info.state === 'error') {
                            if (updateStatusText) updateStatusText.textContent = info.message || 'Gagal memeriksa pembaruan.';
                        } else {
                            const curVer = (info && info.version) || '3.2.0';
                            if (updateStatusText) updateStatusText.textContent = `LivelyLyrics Anda sudah menggunakan versi paling mutakhir (v${curVer}).`;
                        }
                    })
                    .catch(() => {
                        if (updateStatusText) updateStatusText.textContent = 'Gagal memeriksa pembaruan. Silakan periksa koneksi internet Anda.';
                    });
            }
        });
    }

    if (btnDownloadUpdate) {
        btnDownloadUpdate.addEventListener('click', () => {
            if (updateProgressBar) updateProgressBar.classList.remove('hidden');
            if (updateProgressFill) updateProgressFill.style.width = '0%';
            if (updateStatusText) updateStatusText.textContent = 'Mengunduh pembaruan...';
            if (window.electronAPI && window.electronAPI.downloadUpdate) {
                window.electronAPI.downloadUpdate().catch(() => {});
            }
        });
    }

    if (btnInstallUpdate) {
        btnInstallUpdate.addEventListener('click', () => {
            if (window.electronAPI && window.electronAPI.installUpdate) {
                window.electronAPI.installUpdate();
            }
        });
    }

    // Real-time update status listener
    if (window.electronAPI && window.electronAPI.onUpdateStatus) {
        window.electronAPI.onUpdateStatus((status) => {
            if (!status) return;

            if (status.message && updateStatusText) {
                updateStatusText.textContent = status.message;
            }

            if (status.state === 'available') {
                if (btnDownloadUpdate) btnDownloadUpdate.classList.remove('hidden');
                if (btnInstallUpdate) btnInstallUpdate.classList.add('hidden');
                if (updateProgressBar) updateProgressBar.classList.add('hidden');
            } else if (status.state === 'downloading') {
                if (updateProgressBar) updateProgressBar.classList.remove('hidden');
                if (updateProgressFill) updateProgressFill.style.width = `${status.progress || 0}%`;
                if (btnDownloadUpdate) btnDownloadUpdate.classList.add('hidden');
                if (btnInstallUpdate) btnInstallUpdate.classList.add('hidden');
            } else if (status.state === 'downloaded') {
                if (updateProgressBar) updateProgressBar.classList.add('hidden');
                if (btnDownloadUpdate) btnDownloadUpdate.classList.add('hidden');
                if (btnInstallUpdate) btnInstallUpdate.classList.remove('hidden');
            } else if (status.state === 'not-available' || status.state === 'error') {
                if (btnDownloadUpdate) btnDownloadUpdate.classList.add('hidden');
                if (btnInstallUpdate) btnInstallUpdate.classList.add('hidden');
                if (updateProgressBar) updateProgressBar.classList.add('hidden');
            }
        });
    }

    // Initialize UI on load
    document.addEventListener('DOMContentLoaded', initValues);
    initValues();
})();
