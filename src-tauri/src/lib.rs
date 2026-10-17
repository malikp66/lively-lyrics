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
    is_click_through: Mutex<bool>,
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
) -> Result<(), String> {
    // Reset track ID to force re-fetch
    {
        let mut last_id = state.last_track_id.lock().unwrap();
        *last_id = String::new();
    }

    if let Some(media) = media::poll_media_state() {
        let _ = app.emit("media-update", &media);
        let client = state.http_client.clone();
        let lyrics = lyrics::fetch_lyrics(
            &client,
            &media.title,
            &media.artist,
            &media.album,
            media.duration,
            &media.artwork_url,
        )
        .await;
        let payload = models::LyricsEventPayload {
            track_key: format!("{} - {}", media.title, media.artist).to_lowercase(),
            lyrics,
        };
        let _ = app.emit("lyrics-loaded", &payload);

        let mut last_id = state.last_track_id.lock().unwrap();
        *last_id = media.track_id;
    }
    Ok(())
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
        .header("User-Agent", "LivelyLyrics/3.0.0")
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
fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_app_version() -> String {
    "3.0.0".to_string()
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
        is_click_through: Mutex::new(false),
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
            search_lyrics_manual,
            set_click_through,
            set_always_on_top,
            set_window_opacity,
            minimize_window,
            close_window,
            resize_window,
            get_app_version,
            get_platform
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            let state_clone = app_state.clone();

            // Background media polling thread
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(Duration::from_millis(900));

                    if let Some(media) = media::poll_media_state() {
                        let track_changed = {
                            let mut last_id = state_clone.last_track_id.lock().unwrap();
                            if *last_id != media.track_id {
                                *last_id = media.track_id.clone();
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

                        // If track changed, fetch new lyrics
                        if track_changed && !media.title.is_empty() {
                            let client = state_clone.http_client.clone();
                            let h = handle.clone();
                            let title = media.title.clone();
                            let artist = media.artist.clone();
                            let album = media.album.clone();
                            let dur = media.duration;
                            let art = media.artwork_url.clone();

                            tauri::async_runtime::spawn(async move {
                                let lyrics = lyrics::fetch_lyrics(&client, &title, &artist, &album, dur, &art).await;
                                let payload = models::LyricsEventPayload {
                                    track_key: format!("{} - {}", title, artist).to_lowercase(),
                                    lyrics,
                                };
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
