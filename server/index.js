const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { fetchPlaylistTracks } = require("./spotify");
const { getChatResponse } = require("./gemini");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors({ origin: "*" }));
app.use(express.json());

// Simple request logger for visibility during development and demos.
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

function isPlaylistIntent(message) {
  const text = String(message || "").toLowerCase();
  return /(^|\b)(playlist|songs to play|what should i play|song picks|song recommendations|mix)\b/.test(
    text
  );
}

function playlistReply(playlistPayload) {
  const picks = playlistPayload.tracks.slice(0, 6);
  const lines = picks.map((track, index) => `${index + 1}. ${track.artist} - ${track.name}`);
  return [
    `Here is a playlist for ${playlistPayload.country_name} in ${playlistPayload.year}:`,
    ...lines,
    "I also attached the full in-app playlist below, tap 'Open full playlist' to explore all tracks."
  ].join("\n");
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "bingbeats",
    integrations: {
      spotify_configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      gemini_configured: Boolean(process.env.GEMINI_API_KEY)
    }
  });
});

app.get("/api/public-config", (req, res) => {
  const mapboxPublicToken = process.env.MAPBOX_PUBLIC_TOKEN || "";
  res.json({
    mapbox_public_token: mapboxPublicToken
  });
});

app.post("/api/playlist", async (req, res) => {
  const { country_code: countryCode, year } = req.body || {};

  if (!countryCode || !year) {
    return res.status(400).json({
      error: "country_code and year are required."
    });
  }

  try {
    const result = await fetchPlaylistTracks(String(countryCode).toUpperCase(), Number(year));
    return res.json(result);
  } catch (error) {
    console.error("Playlist endpoint error:", error.message);
    return res.status(502).json({
      error: "Failed to fetch playlist data from Spotify."
    });
  }
});

app.post("/api/chat", async (req, res) => {
  const { message, context = {}, history = [] } = req.body || {};

  if (!message || typeof message !== "string") {
    return res.status(400).json({
      error: "message is required and must be a string."
    });
  }

  if (!Array.isArray(history)) {
    return res.status(400).json({
      error: "history must be an array."
    });
  }

  try {
    const code =
      context.country_code && String(context.country_code).trim().length >= 2
        ? String(context.country_code).trim().toUpperCase().slice(0, 2)
        : null;
    const yearNum = context.year != null && Number.isFinite(Number(context.year)) ? Number(context.year) : null;

    let enrichedContext = { ...context };
    let playlistPayload = null;

    if (code && yearNum) {
      try {
        const result = await fetchPlaylistTracks(code, yearNum);
        const trackLabels = (result.tracks || []).map((t) => `${t.artist} — ${t.name}`);

        enrichedContext = {
          ...context,
          country: context.country || result.country_code,
          year: result.year,
          current_tracks: trackLabels
        };

        if (result.tracks && result.tracks.length > 0) {
          playlistPayload = {
            country_code: result.country_code,
            year: result.year,
            country_name: typeof context.country === "string" ? context.country : result.country_code,
            tracks: result.tracks.map((t) => ({
              id: t.id,
              name: t.name,
              artist: t.artist,
              album: t.album,
              album_art: t.album_art,
              preview_url: t.preview_url,
              spotify_url: t.spotify_url,
              release_date: t.release_date ?? ""
            }))
          };
        }
      } catch (playlistErr) {
        console.warn("[Chat] Playlist fetch for context (non-fatal):", playlistErr?.message || playlistErr);
      }
    }

    if (isPlaylistIntent(message) && playlistPayload?.tracks?.length) {
      return res.json({
        response: playlistReply(playlistPayload),
        playlist: playlistPayload
      });
    }

    if (isPlaylistIntent(message) && !playlistPayload) {
      return res.json({
        response:
          "I can build a playlist right away once you pick a country and year on Home. Then ask 'give me a playlist' or tap the playlist suggestion chip in chat.",
        playlist: null
      });
    }

    const responseText = await getChatResponse({
      message,
      context: enrichedContext,
      history
    });

    return res.json({ response: responseText, playlist: playlistPayload });
  } catch (error) {
    const messageText =
      error && typeof error.message === "string"
        ? error.message
        : typeof error === "string"
          ? error
          : error
            ? JSON.stringify(error)
            : "Unknown error";
    console.error("Chat endpoint error:", messageText);
    const safe = String(messageText).replace(/\s+/g, " ").trim().slice(0, 800);
    return res.status(502).json({
      error:
        safe ||
        "Failed to generate response from Gemini. Restart the server after changing server/.env or GEMINI_MODEL."
    });
  }
});

// Fallback JSON 404 handler.
app.use((req, res) => {
  res.status(404).json({ error: "Route not found." });
});

// Centralized JSON error handler.
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
