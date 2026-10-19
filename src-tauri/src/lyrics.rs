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

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LrclibTrack {
    #[allow(dead_code)]
    id: Option<i64>,
    track_name: Option<String>,
    artist_name: Option<String>,
    album_name: Option<String>,
    duration: Option<f64>,
    synced_lyrics: Option<String>,
    plain_lyrics: Option<String>,
}

pub fn get_lyrics_timestamp_span(lrc_text: &str) -> Option<(f64, f64, usize)> {
    let mut first: Option<f64> = None;
    let mut last: Option<f64> = None;
    let mut count = 0;

    for line in lrc_text.lines() {
        for caps in TIME_REGEX.captures_iter(line) {
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
            let t = min * 60.0 + sec + ms;
            if first.is_none() || Some(t) < first {
                first = Some(t);
            }
            if last.is_none() || Some(t) > last {
                last = Some(t);
            }
            count += 1;
        }
    }

    match (first, last) {
        (Some(f), Some(l)) => Some((f, l, count)),
        _ => None,
    }
}

fn score_candidate(track: &LrclibTrack, spotify_dur: f64, target_title: &str, target_artist: &str) -> f64 {
    let mut score = 50.0;
    let track_name = track.track_name.as_deref().unwrap_or("").to_lowercase();
    let album_name = track.album_name.as_deref().unwrap_or("").to_lowercase();
    let artist_name = track.artist_name.as_deref().unwrap_or("").to_lowercase();

    // 1. Check actual lyrics timestamps & completeness
    if let Some(synced) = &track.synced_lyrics {
        if let Some((first_t, last_t, line_count)) = get_lyrics_timestamp_span(synced) {
            if spotify_dur > 45.0 {
                let coverage = last_t / spotify_dur;

                // Truncated lyrics penalty: e.g. lyrics stop prematurely before end of song
                if coverage < 0.65 {
                    score -= 600.0;
                } else if coverage >= 0.94 {
                    score += 240.0; // Complete song coverage (end of song)
                } else if coverage >= 0.85 {
                    score += 160.0;
                } else if coverage >= 0.72 {
                    score += 80.0;
                }

                // Late start penalty: e.g. lyrics start at 138s on a 198s song (remix verse only)
                if first_t > spotify_dur * 0.40 {
                    score -= 350.0;
                } else if first_t < 40.0 {
                    score += 40.0;
                }

                // Natural ending near track duration (< 15s before track ends)
                let end_gap = (last_t - spotify_dur).abs();
                if end_gap < 12.0 {
                    score += 80.0;
                } else if end_gap < 20.0 {
                    score += 40.0;
                }
            }

            if line_count < 8 {
                score -= 200.0;
            } else if line_count >= 35 {
                score += 80.0; // Comprehensive lyric line breakdown
            } else if line_count >= 18 {
                score += 30.0;
            }
        }
    }

    // 2. Duration precision between audio track and candidate metadata (allow 2s margin for rounding)
    if spotify_dur > 0.0 {
        if let Some(d) = track.duration {
            let diff = (d - spotify_dur).abs();
            if diff < 2.0 {
                score += 150.0; // Studio audio match (within 2s)
            } else if diff < 4.0 {
                score += 70.0;
            } else if diff < 7.0 {
                score += 25.0;
            } else {
                score -= diff * 12.0;
            }
        }
    }

    // 3. Video tag penalty: video versions have intro skits/dialogue causing 5-15s desync
    let is_video = track_name.contains("video")
        || track_name.contains("mv")
        || track_name.contains("official video")
        || album_name.contains("video");
    let target_wants_video = target_title.to_lowercase().contains("video");
    if is_video && !target_wants_video {
        score -= 220.0;
    }

    // 4. Remix / Live penalty if current track is studio album version
    let is_remix = track_name.contains("remix") || album_name.contains("remix");
    let target_is_remix = target_title.to_lowercase().contains("remix");
    if is_remix && !target_is_remix {
        score -= 120.0;
    }

    let is_live = track_name.contains("live") || album_name.contains("live");
    let target_is_live = target_title.to_lowercase().contains("live");
    if is_live && !target_is_live {
        score -= 90.0;
    }

    // 5. Clean artist similarity bonus
    if !target_artist.is_empty() && (artist_name.contains(&target_artist.to_lowercase()) || target_artist.to_lowercase().contains(&artist_name)) {
        score += 40.0;
    }

    score
}

pub async fn fetch_lyrics(
    client: &reqwest::Client,
    title: &str,
    artist: &str,
    _album: &str,
    duration: f64,
    native_art: &str,
    cycle_index: usize,
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
        ("User-Agent", "LivelyLyrics/3.1.0 (https://github.com/malikp66/lively-lyrics)"),
    ];

    let mut collected_tracks: Vec<LrclibTrack> = Vec::new();

    // 1. Search endpoints (Search allows ranking multiple LRC uploads by duration precision)
    let mut search_urls = Vec::new();
    if !cleaned_title.is_empty() && !cleaned_artist.is_empty() {
        search_urls.push(format!(
            "https://lrclib.net/api/search?track_name={}&artist_name={}",
            urlencoding::encode(&cleaned_title),
            urlencoding::encode(&cleaned_artist)
        ));
    }
    let query_artist_title = format!("{} {}", cleaned_artist, cleaned_title).trim().to_string();
    if !query_artist_title.is_empty() {
        search_urls.push(format!(
            "https://lrclib.net/api/search?q={}",
            urlencoding::encode(&query_artist_title)
        ));
    }
    if !cleaned_title.is_empty() {
        search_urls.push(format!(
            "https://lrclib.net/api/search?q={}",
            urlencoding::encode(&cleaned_title)
        ));
    }

    for url in search_urls {
        let mut req = client.get(&url);
        for (k, v) in &headers {
            req = req.header(*k, *v);
        }

        if let Ok(res) = req.timeout(Duration::from_secs(8)).send().await {
            if res.status().is_success() {
                if let Ok(list) = res.json::<Vec<LrclibTrack>>().await {
                    for item in list {
                        if !collected_tracks.iter().any(|t| t.id == item.id) {
                            collected_tracks.push(item);
                        }
                    }
                }
            }
        }
        if !collected_tracks.is_empty() {
            break;
        }
    }

    // 2. Direct /api/get fallback if search produced no results
    if collected_tracks.is_empty() {
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

            if let Ok(res) = req.timeout(Duration::from_secs(8)).send().await {
                if res.status().is_success() {
                    if let Ok(track) = res.json::<LrclibTrack>().await {
                        collected_tracks.push(track);
                        break;
                    }
                }
            }
        }
    }

    // 3. Process collected tracks: Rank synced candidates by duration precision and cleanliness
    let mut synced_tracks: Vec<LrclibTrack> = collected_tracks
        .iter()
        .filter(|item| item.synced_lyrics.as_ref().map_or(false, |s| !s.trim().is_empty()))
        .cloned()
        .collect();

    if !synced_tracks.is_empty() {
        // Sort candidates by score descending
        synced_tracks.sort_by(|a, b| {
            let score_a = score_candidate(a, duration, title, artist);
            let score_b = score_candidate(b, duration, title, artist);
            score_b.partial_cmp(&score_a).unwrap_or(std::cmp::Ordering::Equal)
        });

        // Deduplicate candidates that have identical timestamps & line counts
        let mut unique_candidates: Vec<LrclibTrack> = Vec::new();
        let mut seen_signatures: Vec<String> = Vec::new();

        for track in synced_tracks {
            let sig = if let Some(synced) = &track.synced_lyrics {
                if let Some((f, l, cnt)) = get_lyrics_timestamp_span(synced) {
                    format!("{:.0}_{:.0}_{}", f, l, cnt)
                } else {
                    track.id.map(|id| id.to_string()).unwrap_or_default()
                }
            } else {
                track.id.map(|id| id.to_string()).unwrap_or_default()
            };

            if !seen_signatures.contains(&sig) {
                seen_signatures.push(sig);
                unique_candidates.push(track);
            }
        }

        // Cycle through unique distinct candidates if user triggers re-sync
        let chosen_idx = cycle_index % unique_candidates.len();
        let best = &unique_candidates[chosen_idx];
        let raw = best.synced_lyrics.clone().unwrap_or_default();
        let lines = parse_lrc(&raw);

        let candidate_info = if unique_candidates.len() > 1 {
            Some(format!("Sinkronisasi opsi {} dari {}", chosen_idx + 1, unique_candidates.len()))
        } else {
            None
        };

        return LyricsLoaded {
            title: best.track_name.clone().unwrap_or_else(|| title.to_string()),
            artist: best.artist_name.clone().unwrap_or_else(|| artist.to_string()),
            has_synced: true,
            is_plain: false,
            lines,
            raw_lyrics: raw,
            artwork,
            message: candidate_info,
        };
    }

    // 4. Plain lyrics fallback
    for item in &collected_tracks {
        if let Some(plain) = &item.plain_lyrics {
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
                    title: item.track_name.clone().unwrap_or_else(|| title.to_string()),
                    artist: item.artist_name.clone().unwrap_or_else(|| artist.to_string()),
                    has_synced: false,
                    is_plain: true,
                    lines: plain_lines,
                    raw_lyrics: plain.clone(),
                    artwork,
                    message: Some("Lirik teks biasa (tidak bertanda waktu).".to_string()),
                };
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pulang_malu() {
        let client = reqwest::Client::new();
        let res = fetch_lyrics(
            &client,
            "Pulang Malu Tak Pulang Rindu",
            "Armada",
            "Dengerin Abang",
            210.0,
            "",
            0,
        ).await;
        println!("TEST RESULT: title={}, has_synced={}, lines={}", res.title, res.has_synced, res.lines.len());
        assert!(res.has_synced || !res.lines.is_empty(), "Lyrics should be found");
    }

    #[tokio::test]
    async fn test_the_weeknd_reminder_sync() {
        let client = reqwest::Client::new();
        let res = fetch_lyrics(
            &client,
            "Reminder",
            "The Weeknd",
            "Starboy",
            218.88,
            "",
            0,
        ).await;
        println!("TEST REMINDER: title={}, lines={}, first_line_time={:?}", res.title, res.lines.len(), res.lines.first().map(|l| l.time));
        assert!(res.has_synced, "Reminder should have synced lyrics");
        // Verify first line starts around 11 seconds (album track), NOT 23 seconds (video)
        if let Some(first) = res.lines.first() {
            assert!(first.time < 15.0, "First line should start ~11s, got {}", first.time);
        }
    }

    #[tokio::test]
    async fn test_separuh_nafas_full_coverage() {
        let client = reqwest::Client::new();
        let res = fetch_lyrics(
            &client,
            "Separuh Nafas",
            "Dewa 19",
            "Bintang Lima",
            222.0,
            "",
            0,
        ).await;
        println!("TEST SEPARUH NAFAS: title={}, lines={}, first={:?}, last={:?}",
            res.title, res.lines.len(), res.lines.first().map(|l| l.time), res.lines.last().map(|l| l.time));
        assert!(res.has_synced, "Separuh Nafas should have synced lyrics");
        assert!(res.lines.len() >= 35, "Should NOT pick truncated 28-line candidate, got {} lines", res.lines.len());
        if let Some(last) = res.lines.last() {
            assert!(last.time > 190.0, "Last line should be near end of song (>190s), got {}", last.time);
        }
        if let Some(first) = res.lines.first() {
            assert!(first.time >= 20.0, "First vocal line of Separuh Nafas starts ~23s, got {}", first.time);
        }
    }
}

