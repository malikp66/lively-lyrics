use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaUpdate {
    pub active: bool,
    pub app_id: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub artwork_url: String,
    pub status: String,
    pub position: f64,
    pub duration: f64,
    pub is_playing: bool,
    pub track_id: String,
    pub source: String,
    pub last_updated: u64,
}

impl MediaUpdate {
    pub fn inactive() -> Self {
        Self {
            active: false,
            app_id: String::new(),
            title: String::new(),
            artist: String::new(),
            album: String::new(),
            artwork_url: String::new(),
            status: "Paused".to_string(),
            position: 0.0,
            duration: 0.0,
            is_playing: false,
            track_id: String::new(),
            source: String::new(),
            last_updated: 0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricLine {
    pub time: f64,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsLoaded {
    pub title: String,
    pub artist: String,
    pub has_synced: bool,
    pub is_plain: bool,
    pub lines: Vec<LyricLine>,
    pub raw_lyrics: String,
    pub artwork: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LyricsEventPayload {
    pub track_key: String,
    pub lyrics: LyricsLoaded,
}
