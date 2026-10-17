use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaUpdate {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub album_art: String,
    pub status: String,
    pub position: f64,
    pub duration: f64,
    pub is_playing: bool,
    pub track_id: String,
    pub source: String,
    pub last_updated: u64,
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
