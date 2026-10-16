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
 * Fetch with automatic 429 and 503 retry backoff
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
            if ((res.status === 503 || res.status === 502 || res.status === 504) && attempt < retries) {
                console.warn(`[LyricsService] Server ${res.status}. Retrying attempt ${attempt + 1}...`);
                await sleep(500 * (attempt + 1));
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
 * Supports [offset: +/-ms], colon milliseconds, and multi-digit minutes
 */
function parseLRC(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split('\n');
    const result = [];
    const timeRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
    const offsetRegex = /\[offset:\s*([+-]?\d+)\s*\]/i;
    let globalOffsetSec = 0;

    // Detect [offset: +/-ms] tag if present
    for (const line of lines) {
        const offsetMatch = line.match(offsetRegex);
        if (offsetMatch) {
            const ms = parseInt(offsetMatch[1], 10);
            if (!isNaN(ms)) {
                globalOffsetSec = ms / 1000;
            }
            break;
        }
    }

    for (const line of lines) {
        if (line.startsWith('[ti:') || line.startsWith('[ar:') || line.startsWith('[al:') || line.startsWith('[by:') || line.startsWith('[offset:')) {
            continue;
        }
        const text = line.replace(timeRegex, '').trim();
        let match;
        timeRegex.lastIndex = 0;
        while ((match = timeRegex.exec(line)) !== null) {
            const min = parseInt(match[1], 10);
            const sec = parseInt(match[2], 10);
            const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
            const timeInSeconds = Math.max(0, (min * 60 + sec + ms / 1000) + globalOffsetSec);
            if (text.length > 0) {
                result.push({
                    time: Math.round(timeInSeconds * 1000) / 1000,
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
async function fetchLyrics(title, artist, album, duration, nativeArtworkUrl = '') {
    const rawKey = `${title} - ${artist}`.toLowerCase();
    const cleanedTitle = cleanSongTitle(title);
    const cleanedArtist = cleanArtist(artist);

    // Fetch artwork concurrently (use iTunes HD artwork first, fallback to native player artworkUrl)
    const artworkPromise = fetchArtwork(cleanedTitle || title, cleanedArtist || artist).then((itunesArt) => {
        return itunesArt || nativeArtworkUrl || null;
    });

    // Check existing positive cache
    if (lyricsCache.has(rawKey)) {
        const cached = lyricsCache.get(rawKey);
        if (cached && (cached.hasSynced || cached.isPlain)) {
            cached.artwork = await artworkPromise;
            return cached;
        }
    }

    const headers = {
        'User-Agent': 'LivelyLyrics/2.2.3 (https://github.com/malikp66/lively-lyrics)'
    };

    let result = null;

    // 1. Exact API /get Strategy First (Fastest, canonical studio sync, immune to 503 search overloads)
    const getAttempts = [
        { track_name: cleanedTitle, artist_name: cleanedArtist, duration: duration > 0 ? Math.round(duration) : null },
        { track_name: cleanedTitle, artist_name: cleanedArtist, duration: null },
        { track_name: title.trim(), artist_name: artist.trim(), duration: null }
    ];

    for (const attempt of getAttempts) {
        if (result && result.hasSynced) break;
        if (!attempt.track_name || !attempt.artist_name) continue;

        try {
            const params = new URLSearchParams({
                track_name: attempt.track_name,
                artist_name: attempt.artist_name
            });
            if (attempt.duration) params.append('duration', attempt.duration.toString());

            const res = await fetchWithRetry(`https://lrclib.net/api/get?${params.toString()}`, { headers }, 1);
            if (res && res.ok) {
                const data = await res.json();
                if (data && data.syncedLyrics) {
                    result = processLyricsResult(data);
                    break;
                } else if (data && data.plainLyrics && !result) {
                    result = processLyricsResult(data);
                }
            }
        } catch (e) {}
    }

    // 2. Search Query Strategy (Fallback if /get did not find synced lyrics)
    if (!result || !result.hasSynced) {
        const noSlashTitle = cleanedTitle.replace(/[/_]/g, ' ').replace(/\s+/g, ' ').trim();
        const splitTitlePart = cleanedTitle.includes('/') ? cleanedTitle.split('/')[0].trim() : '';

        const searchCandidates = [
            `${cleanedArtist} ${noSlashTitle}`.trim(),
            noSlashTitle,
            splitTitlePart ? `${cleanedArtist} ${splitTitlePart}`.trim() : null,
            title.trim()
        ].filter(Boolean);

        const uniqueCandidates = [...new Set(searchCandidates)];

        for (const candidate of uniqueCandidates) {
            if (result && result.hasSynced) break;

            try {
                const res = await fetchWithRetry(`https://lrclib.net/api/search?q=${encodeURIComponent(candidate)}`, { headers }, 1);
                if (res && res.ok) {
                    const list = await res.json();
                    if (Array.isArray(list) && list.length > 0) {
                        const synced = list.filter(item => !!item.syncedLyrics);
                        if (synced.length > 0) {
                            // Filter candidates close to actual playback duration (+/- 7 seconds) to avoid wrong remix/live versions
                            const closeSynced = (duration && duration > 0)
                                ? synced.filter(item => Math.abs(item.duration - duration) <= 7)
                                : synced;
                            const pool = closeSynced.length > 0 ? closeSynced : synced;
                            if (duration && duration > 0) {
                                pool.sort((a, b) => Math.abs(a.duration - duration) - Math.abs(b.duration - duration));
                            }
                            result = processLyricsResult(pool[0]);
                            break;
                        } else if (!result) {
                            const plain = list.filter(item => !!item.plainLyrics);
                            if (plain.length > 0) {
                                result = processLyricsResult(plain[0]);
                            }
                        }
                    }
                }
                await sleep(150);
            } catch (e) {
                console.warn('[LyricsService] Candidate search error:', e.message);
            }
        }
    }

    if (!result) {
        result = {
            hasSynced: false,
            isPlain: false,
            lines: [],
            rawLyrics: '',
            message: 'Lirik belum tersedia untuk lagu ini. Tekan Cmd/Ctrl+R atau Sync Ulang untuk mencari kembali.'
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
