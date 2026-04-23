const { GoogleGenerativeAI } = require("@google/generative-ai");

function ensureGeminiEnv() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in environment variables.");
  }
}

function buildSystemPrompt(context = {}) {
  const country = context.country || "Unknown country";
  const year = context.year || "Unknown year";
  const hasTracks = Array.isArray(context.current_tracks) && context.current_tracks.length > 0;
  const currentTracks = hasTracks ? context.current_tracks.join(" | ") : "";

  return [
    "You are BingBeats Guide, a friendly music discovery assistant inside a mobile app.",
    `The user is exploring music from ${country} in ${year}.`,
    hasTracks
      ? `A real catalog playlist for this place & year is available. Tracks (use these exact names when talking about a playlist): ${currentTracks}.`
      : "No pre-built track list is loaded yet — the user can pick a country and year on the home screen, or you can still discuss genres and eras using general knowledge.",
    "If the user asks for a playlist, song suggestions, what to play, or says 'make me a playlist', treat it as a direct playlist request.",
    "For playlist requests with catalog tracks, output a compact numbered list (about 5-8 picks), use exact artist + title from the provided list, and avoid generic recommendations outside that list.",
    "When asked about genres, name one to three plausible genres or scenes for that place and year with a short note.",
    "If the country or year is vague, say so briefly when you cannot be specific.",
    "Keep answers mobile-friendly. For playlist requests with catalog tracks, prefer 6-10 short lines so the user gets an immediately usable set of songs.",
    "Be warm and clear."
  ].join(" ");
}

/**
 * Inline recent turns into one user message so we can use generateContent (more reliable than chat+system in some SDK stacks).
 */
function buildUserContent(message, history = []) {
  const clean = history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && item.content)
    .slice(-12);

  if (clean.length === 0) {
    return message;
  }

  const lines = clean.map((item) => {
    const label = item.role === "user" ? "User" : "Assistant";
    return `${label}: ${item.content}`;
  });

  return `Here is the conversation so far:\n${lines.join("\n")}\n\nUser: ${message}`;
}

async function getChatResponse({ message, context, history }) {
  ensureGeminiEnv();

  /** Default uses a model that often still has free-tier headroom when gemini-2.0-flash is 429. Override with GEMINI_MODEL. */
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: buildSystemPrompt(context)
  });

  const userPayload = buildUserContent(message, history);
  const result = await model.generateContent(userPayload);

  const response = result.response;

  let text;
  try {
    text = response.text();
  } catch (extractErr) {
    const candidate = response.candidates?.[0];
    const finish = candidate?.finishReason;
    const block = response.promptFeedback?.blockReason;
    const parts = candidate?.content?.parts?.map((p) => p.text).filter(Boolean);
    const fallback = parts?.join("\n")?.trim();
    if (fallback) {
      text = fallback;
    } else {
      const detail = [extractErr?.message, finish && `finish:${finish}`, block && `block:${block}`]
        .filter(Boolean)
        .join(" | ");
      throw new Error(
        detail || "Model returned no extractable text (safety block or empty candidate)."
      );
    }
  }

  if (!text || !String(text).trim()) {
    throw new Error("Gemini returned an empty response.");
  }

  return String(text).trim();
}

module.exports = {
  getChatResponse
};
