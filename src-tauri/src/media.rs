use crate::models::MediaUpdate;
use serde::Deserialize;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Deserialize)]
struct JxaPollResponse {
    active: bool,
    #[serde(rename = "appId")]
    app_id: Option<String>,
    title: Option<String>,
    artist: Option<String>,
    album: Option<String>,
    status: Option<String>,
    position: Option<f64>,
    duration: Option<f64>,
    #[serde(rename = "artworkUrl")]
    artwork_url: Option<String>,
}

#[cfg(target_os = "macos")]
const MAC_JXA_SCRIPT: &str = r#"
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
            artworkUrl: String(artworkUrl)
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
"#;

pub fn poll_media_state() -> Option<MediaUpdate> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("osascript")
            .args(["-l", "JavaScript", "-e", MAC_JXA_SCRIPT])
            .output()
            .ok()?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Ok(res) = serde_json::from_str::<JxaPollResponse>(stdout.trim()) {
                if res.active {
                    let title = res.title.unwrap_or_default();
                    let artist = res.artist.unwrap_or_default();
                    let album = res.album.unwrap_or_default();
                    let status = res.status.unwrap_or_else(|| "Paused".to_string());
                    let is_playing = status == "Playing";
                    let position = res.position.unwrap_or(0.0);
                    let duration = res.duration.unwrap_or(0.0);
                    let album_art = res.artwork_url.unwrap_or_default();
                    let source = res.app_id.unwrap_or_else(|| "Spotify".to_string());

                    let now = SystemTime::now()
                        .duration_since(UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis() as u64;

                    let track_id = format!("{}:{}:{}", source, title, artist);

                    return Some(MediaUpdate {
                        active: true,
                        app_id: source.clone(),
                        title,
                        artist,
                        album,
                        artwork_url: album_art,
                        status,
                        position,
                        duration,
                        is_playing,
                        track_id,
                        source,
                        last_updated: now,
                    });
                }
            }
        }
        Some(MediaUpdate::inactive())
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("playerctl")
            .args(["metadata", "--format", "{{title}}|||{{artist}}|||{{album}}|||{{position}}|||{{mpris:length}}|||{{status}}|||{{mpris:artUrl}}"])
            .output()
            .ok()?;

        if output.status.success() {
            let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let parts: Vec<&str> = raw.split("|||").collect();
            if parts.len() >= 6 {
                let title = parts[0].to_string();
                let artist = parts[1].to_string();
                let album = parts[2].to_string();
                let pos_us: f64 = parts[3].parse().unwrap_or(0.0);
                let len_us: f64 = parts[4].parse().unwrap_or(0.0);
                let status = parts[5].to_string();
                let art = if parts.len() > 6 { parts[6].to_string() } else { String::new() };

                let is_playing = status == "Playing";
                let position = pos_us / 1_000_000.0;
                let duration = len_us / 1_000_000.0;
                let source = "playerctl".to_string();

                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as u64;

                let track_id = format!("{}:{}:{}", source, title, artist);

                return Some(MediaUpdate {
                    active: true,
                    app_id: source.clone(),
                    title,
                    artist,
                    album,
                    artwork_url: art,
                    status,
                    position,
                    duration,
                    is_playing,
                    track_id,
                    source,
                    last_updated: now,
                });
            }
        }
        Some(MediaUpdate::inactive())
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, fallback to lightweight powershell query if native WinRT isn't compiled
        let script = r#"
            try {
                Add-Type -AssemblyName System.Runtime.WindowsRuntime
                $asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
                $mgrOp = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]::RequestAsync()
                $mgr = $asTask.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]).Invoke($null, @($mgrOp)).GetAwaiter().GetResult()
                $session = $mgr.GetCurrentSession()
                if ($session) {
                    $mediaOp = $session.TryGetMediaPropertiesAsync()
                    $media = $asTask.MakeGenericMethod([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]).Invoke($null, @($mediaOp)).GetAwaiter().GetResult()
                    $timeline = $session.GetTimelineProperties()
                    $info = $session.GetPlaybackInfo()
                    @{
                        active = $true
                        title = $media.Title
                        artist = $media.Artist
                        album = $media.AlbumTitle
                        status = $info.PlaybackStatus.ToString()
                        position = $timeline.Position.TotalSeconds
                        duration = $timeline.EndTime.TotalSeconds
                    } | ConvertTo-Json -Compress
                } else {
                    '{"active":false}'
                }
            } catch {
                '{"active":false}'
            }
        "#;
        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output()
            .ok();

        if let Some(out) = output {
            if out.status.success() {
                let stdout = String::from_utf8_lossy(&out.stdout);
                if let Ok(res) = serde_json::from_str::<JxaPollResponse>(stdout.trim()) {
                    if res.active {
                        let title = res.title.unwrap_or_default();
                        let artist = res.artist.unwrap_or_default();
                        let album = res.album.unwrap_or_default();
                        let status = res.status.unwrap_or_else(|| "Paused".to_string());
                        let is_playing = status == "Playing";
                        let position = res.position.unwrap_or(0.0);
                        let duration = res.duration.unwrap_or(0.0);
                        let album_art = res.artwork_url.unwrap_or_default();
                        let source = "SMTC".to_string();

                        let now = SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_default()
                            .as_millis() as u64;

                        let track_id = format!("{}:{}:{}", source, title, artist);

                        return Some(MediaUpdate {
                            active: true,
                            app_id: source.clone(),
                            title,
                            artist,
                            album,
                            artwork_url: album_art,
                            status,
                            position,
                            duration,
                            is_playing,
                            track_id,
                            source,
                            last_updated: now,
                        });
                    }
                }
            }
        }
        Some(MediaUpdate::inactive())
    }
}

pub fn control_media(action: &str, extra: Option<f64>, active_app: &str) {
    #[cfg(target_os = "macos")]
    {
        let target = if active_app == "Music" { "Music" } else { "Spotify" };
        let script = match action {
            "play" | "pause" | "playpause" | "playPause" => format!("tell application \"{}\" to playpause", target),
            "next" => format!("tell application \"{}\" to next track", target),
            "prev" | "previous" => format!("tell application \"{}\" to previous track", target),
            "seek" => {
                let secs = extra.unwrap_or(0.0);
                format!("tell application \"{}\" to set player position to {}", target, secs)
            }
            _ => return,
        };

        let _ = Command::new("osascript").args(["-e", &script]).output();
    }

    #[cfg(target_os = "linux")]
    {
        let _ = match action {
            "play" | "pause" | "playpause" | "playPause" => Command::new("playerctl").arg("play-pause").output(),
            "next" => Command::new("playerctl").arg("next").output(),
            "prev" | "previous" => Command::new("playerctl").arg("previous").output(),
            "seek" => {
                let secs = extra.unwrap_or(0.0);
                Command::new("playerctl").args(["position", &secs.to_string()]).output()
            }
            _ => return,
        };
    }

    #[cfg(target_os = "windows")]
    {
        // Media key simulation or powershell command
        let ps_cmd = match action {
            "play" | "pause" | "playpause" | "playPause" => "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]179)",
            "next" => "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]176)",
            "prev" | "previous" => "$w = New-Object -ComObject WScript.Shell; $w.SendKeys([char]177)",
            _ => return,
        };
        let _ = Command::new("powershell").args(["-NoProfile", "-NonInteractive", "-Command", ps_cmd]).output();
    }
}
