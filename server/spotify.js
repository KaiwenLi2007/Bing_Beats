const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";

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

async function fetchPlaylistTracks(countryCode, year) {
  const accessToken = await getSpotifyAccessToken();

  const params = new URLSearchParams({
    q: `year:${year}`,
    type: "track",
    market: countryCode,
    limit: "20"
  });

  const response = await fetch(`${SPOTIFY_SEARCH_URL}?${params.toString()}`, {
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
  const trackItems = data?.tracks?.items || [];
  const mapped = trackItems.map(mapTrack);
  const selectedTracks = pickTopTracks(mapped, 6);

  return {
    country_code: countryCode,
    year,
    tracks: selectedTracks,
    message:
      selectedTracks.length === 0
        ? "No tracks found for this country/year combination."
        : undefined
  };
}

module.exports = {
  fetchPlaylistTracks
};
