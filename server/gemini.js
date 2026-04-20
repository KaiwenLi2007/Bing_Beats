const { GoogleGenerativeAI } = require("@google/generative-ai");

function ensureGeminiEnv() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is missing in environment variables.");
  }
}

function buildSystemPrompt(context = {}) {
  const country = context.country || "Unknown country";
  const year = context.year || "Unknown year";
  const currentTracks = Array.isArray(context.current_tracks)
    ? context.current_tracks.join("; ")
    : "";

  return [
    "You are BingBeats Guide, a friendly music discovery assistant inside a mobile app.",
    `You are currently helping the user explore music from ${country} in ${year}.`,
    currentTracks
      ? `The user is currently listening to: ${currentTracks}.`
      : "No current track list is available right now.",
    "Keep answers concise and mobile-friendly in 2-3 sentences.",
    "Be warm, clear, and informative, and avoid overly long lists."
  ].join(" ");
}

function mapHistoryForGemini(history = []) {
  return history
    .filter((item) => item && (item.role === "user" || item.role === "assistant") && item.content)
    .map((item) => ({
      role: item.role === "assistant" ? "model" : "user",
      parts: [{ text: item.content }]
    }));
}

async function getChatResponse({ message, context, history }) {
  ensureGeminiEnv();

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: buildSystemPrompt(context)
  });

  const chat = model.startChat({
    history: mapHistoryForGemini(history)
  });

  const result = await chat.sendMessage(message);
  const text = result.response?.text?.();

  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  return text.trim();
}

module.exports = {
  getChatResponse
};
