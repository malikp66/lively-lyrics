mod lyrics;
mod media;
mod models;

use models::LyricsLoaded;
use std::str::FromStr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager, State};
use tauri_plugin_global_shortcut::{Shortcut, ShortcutState};

struct AppState {
    http_client: reqwest::Client,
    active_source: Mutex<String>,
    last_track_id: Mutex<String>,
    lyrics_cycle_index: Mutex<usize>,
    is_click_through: Mutex<bool>,
    current_media: Mutex<Option<models::MediaUpdate>>,
    current_lyrics: Mutex<Option<models::LyricsEventPayload>>,
}

#[tauri::command]
fn get_current_media(state: State<'_, Arc<AppState>>) -> Option<models::MediaUpdate> {
    state.current_media.lock().unwrap().clone()
}

#[tauri::command]
fn get_current_lyrics(state: State<'_, Arc<AppState>>) -> Option<models::LyricsEventPayload> {
    state.current_lyrics.lock().unwrap().clone()
}

#[tauri::command]
fn control_media(state: State<'_, Arc<AppState>>, action: String, extra: Option<f64>) {
    let source = state.active_source.lock().unwrap().clone();
    media::control_media(&action, extra, &source);
}

#[tauri::command]
async fn resync_media(
    app: tauri::AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<Option<models::LyricsEventPayload>, String> {
    // Reset track ID and advance cycle to try next candidate
    let cycle = {
        let mut last_id = state.last_track_id.lock().unwrap();
        *last_id = String::new();
        let mut c = state.lyrics_cycle_index.lock().unwrap();
        *c = (*c + 1) % 10;
        *c
    };

    if let Some(media) = media::poll_media_state() {
        {
            let mut cm = state.current_media.lock().unwrap();
            *cm = Some(media.clone());
        }
        let _ = app.emit("media-update", &media);
        let client = state.http_client.clone();
        let lyrics = lyrics::fetch_lyrics(
            &client,
            &media.title,
            &media.artist,
            &media.album,
            media.duration,
            &media.artwork_url,
            cycle,
        )
        .await;
        let payload = models::LyricsEventPayload {
            track_key: format!("{} - {}", media.title, media.artist).to_lowercase(),
            lyrics,
        };
        {
            let mut cl = state.current_lyrics.lock().unwrap();
            *cl = Some(payload.clone());
        }
        let _ = app.emit("lyrics-loaded", &payload);

        let mut last_id = state.last_track_id.lock().unwrap();
        *last_id = media.track_id;
        return Ok(Some(payload));
    }
    Ok(None)
}

#[tauri::command]
async fn search_lyrics_manual(
    state: State<'_, Arc<AppState>>,
    query: String,
) -> Result<LyricsLoaded, String> {
    let client = &state.http_client;
    let url = format!(
        "https://lrclib.net/api/search?q={}",
        urlencoding::encode(&query)
    );

    let res = client
        .get(&url)
        .header("User-Agent", "LivelyLyrics/3.1.0")
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        if let Ok(list) = res.json::<Vec<serde_json::Value>>().await {
            for item in list {
                if let Some(synced) = item.get("syncedLyrics").and_then(|v| v.as_str()) {
                    if !synced.trim().is_empty() {
                        let lines = lyrics::parse_lrc(synced);
                        let title = item.get("trackName").and_then(|v| v.as_str()).unwrap_or(&query).to_string();
                        let artist = item.get("artistName").and_then(|v| v.as_str()).unwrap_or("").to_string();
                        let artwork = lyrics::fetch_artwork(client, &title, &artist).await;

                        return Ok(LyricsLoaded {
                            title,
                            artist,
                            has_synced: true,
                            is_plain: false,
                            lines,
                            raw_lyrics: synced.to_string(),
                            artwork,
                            message: None,
                        });
                    }
                }
            }
        }
    }

    Err("Tidak ada lirik sinkron ditemukan untuk pencarian ini.".to_string())
}

#[tauri::command]
fn set_click_through(
    window: tauri::Window,
    state: State<'_, Arc<AppState>>,
    enabled: bool,
) -> Result<(), String> {
    if let Ok(mut ct) = state.is_click_through.lock() {
        *ct = enabled;
    }
    window.set_ignore_cursor_events(enabled).map_err(|e| e.to_string())?;
    let _ = window.emit("click-through-changed", enabled);
    Ok(())
}

#[tauri::command]
fn set_always_on_top(window: tauri::Window, enabled: bool) -> Result<(), String> {
    window.set_always_on_top(enabled).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_opacity(_window: tauri::Window, _opacity: f64) -> Result<(), String> {
    // Tauri webview supports CSS opacity or window decorations
    Ok(())
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn start_dragging(window: tauri::Window) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(settings_win) = app.get_webview_window("settings") {
        if let Some(main_win) = app.get_webview_window("main") {
            if let (Ok(main_pos), Ok(main_size)) = (main_win.outer_position(), main_win.outer_size()) {
                let scale = main_win.scale_factor().unwrap_or(1.0);
                let (mon_x, mon_y, mon_w, mon_h) = if let Ok(Some(mon)) = main_win.current_monitor() {
                    (mon.position().x, mon.position().y, mon.size().width as i32, mon.size().height as i32)
                } else {
                    (0, 0, (1920.0 * scale) as i32, (1080.0 * scale) as i32)
                };

                let set_w = (500.0 * scale) as i32;
                let set_h = (530.0 * scale) as i32;
                let gap = (10.0 * scale) as i32;
                let main_w_i32 = main_size.width as i32;
                let main_h_i32 = main_size.height as i32;

                // Calculate bounds
                let min_safe_top = mon_y + (30.0 * scale) as i32;
                let max_safe_bottom = mon_y + mon_h - (10.0 * scale) as i32;

                // Priority 1: Right above the miniplayer (centered horizontally)
                let mut target_x = main_pos.x + (main_w_i32 - set_w) / 2;
                let mut target_y = main_pos.y - set_h - gap;

                // If not enough room above, place right below the miniplayer
                if target_y < min_safe_top {
                    if main_pos.y + main_h_i32 + gap + set_h <= max_safe_bottom {
                        target_y = main_pos.y + main_h_i32 + gap;
                    } else if main_pos.x + main_w_i32 + gap + set_w <= mon_x + mon_w {
                        // Place adjacent right
                        target_x = main_pos.x + main_w_i32 + gap;
                        target_y = main_pos.y;
                    } else if main_pos.x - set_w - gap >= mon_x {
                        // Place adjacent left
                        target_x = main_pos.x - set_w - gap;
                        target_y = main_pos.y;
                    } else {
                        // Fallback below clamped
                        target_y = main_pos.y + main_h_i32 + gap;
                    }
                }

                // Clamp to monitor boundaries to ensure full visibility
                let clamped_x = target_x.clamp(mon_x + (10.0 * scale) as i32, (mon_x + mon_w - set_w - (10.0 * scale) as i32).max(mon_x));
                let clamped_y = target_y.clamp(min_safe_top, (mon_y + mon_h - set_h - (10.0 * scale) as i32).max(min_safe_top));

                let _ = settings_win.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(clamped_x, clamped_y)));
            }
        }
        let _ = settings_win.show();
        let _ = settings_win.set_focus();
    }
    Ok(())
}

#[tauri::command]
fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn get_app_version() -> String {
    "3.1.0".to_string()
}

#[tauri::command]
fn get_platform() -> String {
    #[cfg(target_os = "macos")]
    return "darwin".to_string();
    #[cfg(target_os = "windows")]
    return "win32".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = Arc::new(AppState {
        http_client: reqwest::Client::builder()
            .timeout(Duration::from_secs(6))
            .build()
            .unwrap_or_default(),
        active_source: Mutex::new("Spotify".to_string()),
        last_track_id: Mutex::new(String::new()),
        lyrics_cycle_index: Mutex::new(0),
        is_click_through: Mutex::new(false),
        current_media: Mutex::new(None),
        current_lyrics: Mutex::new(None),
    });

    let ghost_shortcut = Shortcut::from_str("CommandOrControl+Alt+G").expect("valid ghost shortcut");
    let lyrics_shortcut = Shortcut::from_str("CommandOrControl+Alt+L").expect("valid lyrics shortcut");

    let shortcut_state_clone = app_state.clone();
    let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts(["CommandOrControl+Alt+G", "CommandOrControl+Alt+L"])
        .expect("shortcuts registration")
        .with_handler(move |app, shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                if shortcut == &ghost_shortcut {
                    let is_now_ghost = {
                        let mut ct = shortcut_state_clone.is_click_through.lock().unwrap();
                        *ct = !*ct;
                        *ct
                    };
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_ignore_cursor_events(is_now_ghost);
                        let _ = window.emit("click-through-changed", is_now_ghost);
                    }
                } else if shortcut == &lyrics_shortcut {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("toggle-only-lyrics-shortcut", ());
                    }
                }
            }
        })
        .build();

    tauri::Builder::default()
        .plugin(shortcut_plugin)
        .manage(app_state.clone())
        .invoke_handler(tauri::generate_handler![
            control_media,
            resync_media,
            get_current_media,
            get_current_lyrics,
            search_lyrics_manual,
            set_click_through,
            set_always_on_top,
            set_window_opacity,
            minimize_window,
            close_window,
            resize_window,
            start_dragging,
            open_settings_window,
            close_settings_window,
            get_app_version,
            get_platform
        ])
        .on_window_event(|window, event| {
            if window.label() == "settings" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .setup(move |app| {
            let handle = app.handle().clone();
            let state_clone = app_state.clone();

            // Background media polling thread
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_millis(900));

                    if let Some(media) = media::poll_media_state() {
                        {
                            let mut cm = state_clone.current_media.lock().unwrap();
                            *cm = Some(media.clone());
                        }

                        let track_changed = {
                            let mut last_id = state_clone.last_track_id.lock().unwrap();
                            if *last_id != media.track_id {
                                *last_id = media.track_id.clone();
                                *state_clone.lyrics_cycle_index.lock().unwrap() = 0;
                                true
                            } else {
                                false
                            }
                        };

                        {
                            let mut src = state_clone.active_source.lock().unwrap();
                            *src = media.source.clone();
                        }

                        // Emit media update to webview
                        let _ = handle.emit("media-update", &media);

                        // If track changed or lyrics not loaded for this active track, fetch lyrics
                        let needs_lyrics = {
                            if track_changed {
                                true
                            } else if !media.title.is_empty() {
                                let cl = state_clone.current_lyrics.lock().unwrap();
                                cl.as_ref().map_or(true, |p| {
                                    p.track_key != format!("{} - {}", media.title, media.artist).to_lowercase()
                                })
                            } else {
                                false
                            }
                        };

                        if needs_lyrics && !media.title.is_empty() {
                            let client = state_clone.http_client.clone();
                            let h = handle.clone();
                            let s = state_clone.clone();
                            let title = media.title.clone();
                            let artist = media.artist.clone();
                            let album = media.album.clone();
                            let dur = media.duration;
                            let art = media.artwork_url.clone();

                            tauri::async_runtime::spawn(async move {
                                let cycle = *s.lyrics_cycle_index.lock().unwrap();
                                let lyrics = lyrics::fetch_lyrics(&client, &title, &artist, &album, dur, &art, cycle).await;
                                let payload = models::LyricsEventPayload {
                                    track_key: format!("{} - {}", title, artist).to_lowercase(),
                                    lyrics,
                                };
                                {
                                    let mut cl = s.current_lyrics.lock().unwrap();
                                    *cl = Some(payload.clone());
                                }
                                let _ = h.emit("lyrics-loaded", &payload);
                            });
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
