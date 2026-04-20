const { enrichTrackWithItunesPreview } = require("./itunes");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

// Spotify search: public docs often say limit up to 50, but with **Client Credentials**
// the API rejects any limit above 10 with 400 "Invalid limit" (verified against live API).
// We page with limit=10 (max allowed) and optionally a second request to still gather ~20 candidates.
const SPOTIFY_SEARCH_PAGE_LIMIT = 10;
const SPOTIFY_SEARCH_MAX_PAGES = 2;

// In-memory cache for client credentials token.
// This is enough for a single server instance and keeps code easy to follow.
let cachedToken = null;
let tokenExpiresAtMs = 0;

function ensureSpotifyEnv() {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify credentials are missing in environment variables.");
  }
}

async function getSpotifyAccessToken() {
  ensureSpotifyEnv();

  // Reuse token if still valid.
  if (cachedToken && Date.now() < tokenExpiresAtMs) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: new URLSearchParams({ grant_type: "client_credentials" })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Spotify auth failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const accessToken = data.access_token;
  const expiresInSec = Number(data.expires_in) || 3600;

  // Cache for up to ~55 minutes to avoid expiry edge cases.
  const cacheDurationMs = Math.min(expiresInSec, 3300) * 1000;
  cachedToken = accessToken;
  tokenExpiresAtMs = Date.now() + cacheDurationMs;

  return cachedToken;
}

function mapTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
    album: track.album?.name || "Unknown Album",
    album_art: track.album?.images?.[0]?.url || null,
    preview_url: track.preview_url || null,
    spotify_url: track.external_urls?.spotify || null,
    release_date: track.album?.release_date || null
  };
}

function pickTopTracks(tracks, limit = 6) {
  // Prefer tracks with previews, then fill remaining slots.
  const withPreview = tracks.filter((t) => t.preview_url);
  const withoutPreview = tracks.filter((t) => !t.preview_url);
  return [...withPreview, ...withoutPreview].slice(0, limit);
}

function dedupeTracksById(tracks) {
  const seen = new Set();
  return tracks.filter((t) => {
    if (!t?.id || seen.has(t.id)) {
      return false;
    }
    seen.add(t.id);
    return true;
  });
}

async function fetchPlaylistTracks(countryCode, year) {
  const accessToken = await getSpotifyAccessToken();

  const yearNum = Math.trunc(Number(year));
  if (!Number.isFinite(yearNum)) {
    throw new Error("Invalid year for Spotify search.");
  }

  const market = String(countryCode).trim().toUpperCase();
  if (market.length !== 2) {
    throw new Error("Invalid country_code for Spotify market (expected 2 letters).");
  }

  let rawItems = [];

  for (let page = 0; page < SPOTIFY_SEARCH_MAX_PAGES; page += 1) {
    const offset = page * SPOTIFY_SEARCH_PAGE_LIMIT;

    const url = new URL(SPOTIFY_SEARCH_URL);
    url.searchParams.set("q", `year:${yearNum}`);
    url.searchParams.set("type", "track");
    url.searchParams.set("market", market);
    url.searchParams.set("limit", String(SPOTIFY_SEARCH_PAGE_LIMIT));
    url.searchParams.set("offset", String(offset));

    console.log("[Spotify] Search URL:", url.toString());

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Spotify search failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const pageItems = data?.tracks?.items || [];
    rawItems = rawItems.concat(pageItems);

    const total = data?.tracks?.total;
    const noMore =
      pageItems.length < SPOTIFY_SEARCH_PAGE_LIMIT ||
      (typeof total === "number" && offset + pageItems.length >= total) ||
      !data?.tracks?.next;

    if (noMore) {
      break;
    }
  }

  const trackItems = dedupeTracksById(rawItems);
  const mapped = trackItems.map(mapTrack);
  const selectedTracks = pickTopTracks(mapped, 6);
  // Spotify often omits preview_url; fill from iTunes Search when possible so the app can play clips.
  const tracksWithPreviews = await Promise.all(
    selectedTracks.map((t) => enrichTrackWithItunesPreview(t))
  );

  return {
    country_code: market,
    year: yearNum,
    tracks: tracksWithPreviews,
    message:
      selectedTracks.length === 0
        ? "No tracks found for this country/year combination."
        : undefined
  };
}

module.exports = {
  fetchPlaylistTracks
};
