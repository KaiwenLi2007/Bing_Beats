/**
 * iTunes Search API provides 30s preview URLs for many tracks when Spotify's
 * Web API returns null preview_url (common after 2024 API changes).
 * https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

const ITUNES_SEARCH = "https://itunes.apple.com/search";

/**
 * @param {string} trackName
 * @param {string} artistName
 * @returns {Promise<string | null>}
 */
async function fetchItunesPreviewUrl(trackName, artistName) {
  const name = String(trackName || "").trim();
  const artist = String(artistName || "").trim();
  if (!name && !artist) {
    return null;
  }

  const term = `${artist} ${name}`.replace(/\s+/g, " ").trim();
  const url = new URL(ITUNES_SEARCH);
  url.searchParams.set("term", term);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "8");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "BingBeatsServer/1.0" }
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    const want = name.toLowerCase();

    for (const r of results) {
      if (!r.previewUrl) {
        continue;
      }
      const rn = typeof r.trackName === "string" ? r.trackName.toLowerCase() : "";
      if (want && (rn.includes(want.slice(0, Math.min(12, want.length))) || want.includes(rn.slice(0, Math.min(8, rn.length))))) {
        return r.previewUrl;
      }
    }

    for (const r of results) {
      if (r.previewUrl) {
        return r.previewUrl;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** @param {object} track */
async function enrichTrackWithItunesPreview(track) {
  if (track.preview_url) {
    return track;
  }
  const preview = await fetchItunesPreviewUrl(track.name, track.artist);
  if (!preview) {
    return track;
  }
  return { ...track, preview_url: preview };
}

module.exports = {
  fetchItunesPreviewUrl,
  enrichTrackWithItunesPreview
};
