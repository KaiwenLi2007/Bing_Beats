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

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "bingbeats" });
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
    const responseText = await getChatResponse({ message, context, history });
    return res.json({ response: responseText });
  } catch (error) {
    console.error("Chat endpoint error:", error.message);
    return res.status(502).json({
      error: "Failed to generate response from Gemini."
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
