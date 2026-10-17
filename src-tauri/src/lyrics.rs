use crate::models::{LyricLine, LyricsLoaded};
use regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;
use std::time::Duration;

static CLEAN_TITLE_RE1: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s*-\s*(Remaster(ed)?|Mono|Stereo|Live|Deluxe|Bonus Track|Radio Edit|Single Version).*").unwrap()
});
static CLEAN_TITLE_RE2: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s*[\(\[](feat|ft\.|with|remaster|live|deluxe|version|explicit|anniversary|soundtrack|from the|edit|official).*?[\)\]]").unwrap()
});
static CLEAN_TITLE_RE3: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\s*-\s*Single").unwrap()
});

static ARTIST_SPLIT_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[,&/]|feat\.|ft\.").unwrap()
});

static TIME_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]").unwrap()
});

static OFFSET_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\[offset:\s*([+-]?\d+)\s*\]").unwrap()
});

pub fn clean_song_title(title: &str) -> String {
    if title.is_empty() {
        return String::new();
    }
    let s = CLEAN_TITLE_RE1.replace_all(title, "");
    let s = CLEAN_TITLE_RE2.replace_all(&s, "");
    let s = CLEAN_TITLE_RE3.replace_all(&s, "");
    s.trim().to_string()
}

pub fn clean_artist(artist: &str) -> String {
    if artist.is_empty() {
        return String::new();
    }
    if let Some(mat) = ARTIST_SPLIT_RE.find(artist) {
        artist[..mat.start()].trim().to_string()
    } else {
        artist.trim().to_string()
    }
}

pub fn parse_lrc(lrc_text: &str) -> Vec<LyricLine> {
    if lrc_text.is_empty() {
        return Vec::new();
    }
    let mut global_offset_sec = 0.0;

    for line in lrc_text.lines() {
        if let Some(caps) = OFFSET_REGEX.captures(line) {
            if let Some(m) = caps.get(1) {
                if let Ok(ms) = m.as_str().parse::<f64>() {
                    global_offset_sec = ms / 1000.0;
                    break;
                }
            }
        }
    }

    let mut result = Vec::new();

    for line in lrc_text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[ti:")
            || trimmed.starts_with("[ar:")
            || trimmed.starts_with("[al:")
            || trimmed.starts_with("[by:")
            || trimmed.starts_with("[offset:")
        {
            continue;
        }

        let text = TIME_REGEX.replace_all(trimmed, "").trim().to_string();
        if text.is_empty() {
            continue;
        }

        for caps in TIME_REGEX.captures_iter(trimmed) {
            let min: f64 = caps.get(1).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
            let sec: f64 = caps.get(2).and_then(|m| m.as_str().parse().ok()).unwrap_or(0.0);
            let ms: f64 = if let Some(m) = caps.get(3) {
                let s = m.as_str();
                let padded = format!("{:0<3}", s);
                let slice = &padded[..3.min(padded.len())];
                slice.parse::<f64>().unwrap_or(0.0) / 1000.0
            } else {
                0.0
            };

            let time_in_sec = (min * 60.0 + sec + ms + global_offset_sec).max(0.0);
            result.push(LyricLine {
                time: (time_in_sec * 1000.0).round() / 1000.0,
                text: text.clone(),
            });
        }
    }

    result.sort_by(|a, b| a.time.partial_cmp(&b.time).unwrap_or(std::cmp::Ordering::Equal));
    result
}

#[derive(Deserialize)]
struct ITunesResponse {
    results: Option<Vec<ITunesResult>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ITunesResult {
    artwork_url100: Option<String>,
}

pub async fn fetch_artwork(client: &reqwest::Client, title: &str, artist: &str) -> Option<String> {
    let clean_art = clean_artist(artist);
    let clean_tit = clean_song_title(title);
    let query = format!("{} {}", clean_art, clean_tit).trim().to_string();
    if query.is_empty() {
        return None;
    }

    let url = format!(
        "https://itunes.apple.com/search?term={}&entity=song&limit=1",
        urlencoding::encode(&query)
    );

    let res = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        .timeout(Duration::from_secs(4))
        .send()
        .await
        .ok()?;

    if res.status().is_success() {
        if let Ok(data) = res.json::<ITunesResponse>().await {
            if let Some(mut results) = data.results {
                if let Some(first) = results.pop() {
                    if let Some(art100) = first.artwork_url100 {
                        return Some(art100.replace("100x100bb", "600x600bb"));
                    }
                }
            }
        }
    }

    None
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrclibTrack {
    #[allow(dead_code)]
    id: Option<i64>,
    track_name: Option<String>,
    artist_name: Option<String>,
    duration: Option<f64>,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

pub async fn fetch_lyrics(
    client: &reqwest::Client,
    title: &str,
    artist: &str,
    _album: &str,
    duration: f64,
    native_art: &str,
) -> LyricsLoaded {
    let cleaned_title = clean_song_title(title);
    let cleaned_artist = clean_artist(artist);

    // Fetch artwork asynchronously
    let itunes_art = fetch_artwork(client, &cleaned_title, &cleaned_artist).await;
    let artwork = itunes_art.or_else(|| {
        if !native_art.is_empty() {
            Some(native_art.to_string())
        } else {
            None
        }
    });

    let headers = [
        ("User-Agent", "LivelyLyrics/3.0.0 (https://github.com/malikp66/lively-lyrics)"),
    ];

    // 1. Direct /api/get attempts
    let get_attempts: Vec<(&str, &str, Option<i64>)> = vec![
        (&cleaned_title, &cleaned_artist, if duration > 0.0 { Some(duration.round() as i64) } else { None }),
        (&cleaned_title, &cleaned_artist, None),
        (title.trim(), artist.trim(), None),
    ];

    for (t, a, d) in get_attempts {
        if t.is_empty() || a.is_empty() {
            continue;
        }

        let mut url = format!(
            "https://lrclib.net/api/get?track_name={}&artist_name={}",
            urlencoding::encode(t),
            urlencoding::encode(a)
        );
        if let Some(dur) = d {
            url.push_str(&format!("&duration={}", dur));
        }

        let mut req = client.get(&url);
        for (k, v) in &headers {
            req = req.header(*k, *v);
        }

        if let Ok(res) = req.timeout(Duration::from_secs(3)).send().await {
            if res.status().is_success() {
                if let Ok(track) = res.json::<LrclibTrack>().await {
                    if let Some(synced) = track.synced_lyrics {
                        if !synced.trim().is_empty() {
                            let lines = parse_lrc(&synced);
                            return LyricsLoaded {
                                title: track.track_name.unwrap_or_else(|| title.to_string()),
                                artist: track.artist_name.unwrap_or_else(|| artist.to_string()),
                                has_synced: true,
                                is_plain: false,
                                lines,
                                raw_lyrics: synced,
                                artwork,
                                message: None,
                            };
                        }
                    }
                    if let Some(plain) = track.plain_lyrics {
                        if !plain.trim().is_empty() {
                            let plain_lines: Vec<LyricLine> = plain
                                .lines()
                                .map(|l| l.trim().to_string())
                                .filter(|l| !l.is_empty())
                                .enumerate()
                                .map(|(idx, text)| LyricLine {
                                    time: (idx as f64) * 4.0,
                                    text,
                                })
                                .collect();
                            return LyricsLoaded {
                                title: track.track_name.unwrap_or_else(|| title.to_string()),
                                artist: track.artist_name.unwrap_or_else(|| artist.to_string()),
                                has_synced: false,
                                is_plain: true,
                                lines: plain_lines,
                                raw_lyrics: plain,
                                artwork,
                                message: None,
                            };
                        }
                    }
                }
            }
        }
    }

    // 2. Fallback to /api/search?q=
    let no_slash_title = cleaned_title.replace(['/', '_'], " ");
    let candidates = vec![
        format!("{} {}", cleaned_artist, no_slash_title).trim().to_string(),
        no_slash_title.trim().to_string(),
        title.trim().to_string(),
    ];

    for candidate in candidates {
        if candidate.is_empty() {
            continue;
        }

        let url = format!(
            "https://lrclib.net/api/search?q={}",
            urlencoding::encode(&candidate)
        );

        let mut req = client.get(&url);
        for (k, v) in &headers {
            req = req.header(*k, *v);
        }

        if let Ok(res) = req.timeout(Duration::from_secs(3)).send().await {
            if res.status().is_success() {
                if let Ok(list) = res.json::<Vec<LrclibTrack>>().await {
                    let mut synced: Vec<LrclibTrack> = list
                        .into_iter()
                        .filter(|item| item.synced_lyrics.as_ref().map_or(false, |s| !s.trim().is_empty()))
                        .collect();

                    if !synced.is_empty() {
                        if duration > 0.0 {
                            synced.sort_by(|a, b| {
                                let da = (a.duration.unwrap_or(0.0) - duration).abs();
                                let db = (b.duration.unwrap_or(0.0) - duration).abs();
                                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
                            });
                        }

                        let best = synced.remove(0);
                        let raw = best.synced_lyrics.unwrap_or_default();
                        let lines = parse_lrc(&raw);
                        return LyricsLoaded {
                            title: best.track_name.unwrap_or_else(|| title.to_string()),
                            artist: best.artist_name.unwrap_or_else(|| artist.to_string()),
                            has_synced: true,
                            is_plain: false,
                            lines,
                            raw_lyrics: raw,
                            artwork,
                            message: None,
                        };
                    }
                }
            }
        }
    }

    LyricsLoaded {
        title: title.to_string(),
        artist: artist.to_string(),
        has_synced: false,
        is_plain: false,
        lines: Vec::new(),
        raw_lyrics: String::new(),
        artwork,
        message: Some("Lirik belum tersedia untuk lagu ini. Tekan Sync Ulang untuk mencari kembali.".to_string()),
    }
}
