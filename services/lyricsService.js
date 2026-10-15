/**
 * lyricsService.js
 * Synchronized lyrics (LRC) & HD album artwork engine.
 * Features:
 * - Smart multi-candidate fuzzy search
 * - 429 Rate-Limit backoff & Cloudflare retry protection
 * - Duration-based matching (nearest duration ranking)
 * - Safe positive-only caching (avoids permanent empty lyric bug)
 */

const lyricsCache = new Map();
const artworkCache = new Map();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function cleanSongTitle(title) {
    if (!title) return '';
    return title
        .replace(/\s*-\s*(Remaster(ed)?|Mono|Stereo|Live|Deluxe|Bonus Track|Radio Edit|Single Version).*/i, '')
        .replace(/\s*\(.*?(feat|ft\.|with|remaster|live|deluxe|version|explicit|anniversary|soundtrack|from the|edit|official).*\)/gi, '')
        .replace(/\s*\[.*?(feat|ft\.|with|remaster|live|deluxe|version|explicit|anniversary|soundtrack|from the|edit|official).*\]/gi, '')
        .replace(/\s*-\s*Single/i, '')
        .trim();
}

function cleanArtist(artist) {
    if (!artist) return '';
    return artist
        .split(/[,&/]|feat\.|ft\./i)[0]
        .trim();
}

/**
 * Fetch with automatic 429 retry backoff
 */
async function fetchWithRetry(url, options = {}, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(url, options);
            if (res.status === 429) {
                const retryAfterHeader = res.headers.get('retry-after');
                const waitMs = retryAfterHeader ? Math.min(3000, parseInt(retryAfterHeader, 10) * 1000) : (1100 * (attempt + 1));
                console.warn(`[LyricsService] 429 Rate Limited. Waiting ${waitMs}ms before retry...`);
                await sleep(waitMs);
                continue;
            }
            return res;
        } catch (err) {
            if (attempt === retries) throw err;
            await sleep(400);
        }
    }
    return null;
}

/**
 * Fetch HD artwork from iTunes API
 */
async function fetchArtwork(title, artist) {
    const key = `${title} - ${artist}`.toLowerCase();
    if (artworkCache.has(key)) {
        return artworkCache.get(key);
    }

    try {
        const query = `${cleanArtist(artist)} ${cleanSongTitle(title)}`.trim();
        const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
        const res = await fetchWithRetry(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (res && res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0 && data.results[0].artworkUrl100) {
                const hdArt = data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
                artworkCache.set(key, hdArt);
                return hdArt;
            }
        }
    } catch (e) {
        console.warn('Artwork fetch error:', e.message);
    }

    artworkCache.set(key, null);
    return null;
}

/**
 * Parse raw LRC string into array of timed objects
 */
function parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const result = [];
    const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    for (const line of lines) {
        const text = line.replace(timeRegex, '').trim();
        let match;
        timeRegex.lastIndex = 0;
        while ((match = timeRegex.exec(line)) !== null) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
            const timeInSeconds = min * 60 + sec + ms / 1000;
            if (text.length > 0) {
                result.push({
                    time: timeInSeconds,
                    text: text
                });
            }
        }
    }

    result.sort((a, b) => a.time - b.time);
    return result;
}

/**
 * Invalidate cache for a track
 */
function invalidateCache(trackKey) {
    if (trackKey) {
        lyricsCache.delete(trackKey.toLowerCase());
    }
}

/**
 * Fetch lyrics from LRCLIB using smart multi-candidate search
 */
async function fetchLyrics(title, artist, album, duration) {
    const rawKey = `${title} - ${artist}`.toLowerCase();
    const cleanedTitle = cleanSongTitle(title);
    const cleanedArtist = cleanArtist(artist);

    // Fetch artwork concurrently
    const artworkPromise = fetchArtwork(cleanedTitle || title, cleanedArtist || artist);

    // Check existing positive cache
    if (lyricsCache.has(rawKey)) {
        const cached = lyricsCache.get(rawKey);
        if (cached && (cached.hasSynced || cached.isPlain)) {
            cached.artwork = await artworkPromise;
            return cached;
        }
    }

    const headers = {
        'User-Agent': 'LivelyLyrics/2.1 (Windows Media Player; Open Source)'
    };

    let result = null;

    // Build intelligent search candidates (handles slashes like 'House Of Balloons / Glass Table Girls')
    const noSlashTitle = cleanedTitle.replace(/[/_]/g, ' ').replace(/\s+/g, ' ').trim();
    const splitTitlePart = cleanedTitle.includes('/') ? cleanedTitle.split('/')[0].trim() : '';

    const searchCandidates = [
        `${cleanedArtist} ${noSlashTitle}`.trim(),
        noSlashTitle,
        splitTitlePart ? `${cleanedArtist} ${splitTitlePart}`.trim() : null,
        title.trim()
    ].filter(Boolean);

    // 1. Search Query Strategy (Most resilient & finds exact synchronized lyrics)
    for (const candidate of searchCandidates) {
        if (result) break;

        try {
            const res = await fetchWithRetry(`https://lrclib.net/api/search?q=${encodeURIComponent(candidate)}`, { headers }, 2);
            if (res && res.ok) {
                const list = await res.json();
                if (Array.isArray(list) && list.length > 0) {
                    // Prioritize entries with synchronized lyrics
                    const synced = list.filter(item => !!item.syncedLyrics);
                    if (synced.length > 0) {
                        if (duration && duration > 0) {
                            // Sort by closest duration to Spotify playback
                            synced.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
                        }
                        result = processLyricsResult(synced[0]);
                        break;
                    } else {
                        // Fallback to plain lyrics if no synced
                        const plain = list.filter(item => !!item.plainLyrics);
                        if (plain.length > 0) {
                            result = processLyricsResult(plain[0]);
                        }
                    }
                }
            }
            await sleep(250); // Friendly pacing
        } catch (e) {
            console.warn('[LyricsService] Candidate error:', e.message);
        }
    }

    // 2. Strict API/get query fallback
    if (!result) {
        try {
            const params = new URLSearchParams({
                track_name: cleanedTitle,
                artist_name: cleanedArtist
            });
            if (duration && duration > 0) params.append('duration', Math.round(duration).toString());

            const res = await fetchWithRetry(`https://lrclib.net/api/get?${params.toString()}`, { headers }, 1);
            if (res && res.ok) {
                const data = await res.json();
                if (data && (data.syncedLyrics || data.plainLyrics)) {
                    result = processLyricsResult(data);
                }
            }
        } catch (e) {}
    }

    if (!result) {
        result = {
            hasSynced: false,
            isPlain: false,
            lines: [],
            rawLyrics: '',
            message: 'Lirik belum tersedia untuk lagu ini. Tekan Ctrl+R atau Sync Ulang untuk mencari kembali.'
        };
        // DO NOT permanently cache empty/failed lyrics!
    } else {
        // Only cache positive matches
        lyricsCache.set(rawKey, result);
    }

    result.artwork = await artworkPromise;
    return result;
}

function processLyricsResult(data) {
    if (data.syncedLyrics) {
        const lines = parseLRC(data.syncedLyrics);
        return {
            id: data.id,
            trackName: data.trackName,
            artistName: data.artistName,
            hasSynced: true,
            isPlain: false,
            lines: lines,
            rawLyrics: data.syncedLyrics
        };
    } else if (data.plainLyrics) {
        const plainLines = data.plainLyrics
            .split('\n')
            .map(text => text.trim())
            .filter(t => t.length > 0)
            .map((text, idx) => ({ time: idx * 4, text }));
        return {
            id: data.id,
            trackName: data.trackName,
            artistName: data.artistName,
            hasSynced: false,
            isPlain: true,
            lines: plainLines,
            rawLyrics: data.plainLyrics
        };
    }
    return {
        hasSynced: false,
        isPlain: false,
        lines: [],
        rawLyrics: ''
    };
}

module.exports = {
    fetchLyrics,
    fetchArtwork,
    cleanSongTitle,
    cleanArtist,
    parseLRC,
    invalidateCache
};
