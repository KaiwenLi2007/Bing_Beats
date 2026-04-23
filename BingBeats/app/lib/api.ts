import type { ChatContext, ChatMessage, ChatPlaylistSnapshot, PlaylistResponse } from "./types";

/** Strip trailing slash; default only works in simulator (use LAN IP on a device). */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

function isLikelyNetworkFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  const e = err as { name?: string; message?: string };
  if (e.name === "TypeError" && typeof e.message === "string") {
    return /network|failed to fetch|load failed|abort/i.test(e.message);
  }
  return false;
}

async function parseError(response: Response, fallbackMessage: string): Promise<never> {
  // Read body once. Do not wrap our own `throw new Error(...)` in try/catch or we
  // accidentally replace the server's `error` message with a generic fallback.
  let detail: string | undefined;
  try {
    const data = (await response.json()) as { error?: string };
    detail = typeof data.error === "string" ? data.error : undefined;
  } catch {
    // Non-JSON body (e.g. HTML from a proxy) — fall through to generic message.
  }
  throw new Error(detail?.trim() || `${fallbackMessage} (${response.status})`);
}

export async function getPlaylist(
  country_code: string,
  year: number
): Promise<PlaylistResponse> {
  const url = `${API_BASE_URL}/api/playlist`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ country_code, year })
    });
  } catch (err) {
    if (isLikelyNetworkFailure(err)) {
      throw new Error(
        `Cannot reach the API at ${API_BASE_URL}. Set EXPO_PUBLIC_API_URL in BingBeats/.env to your deployed backend URL (for example your Render service URL), then restart Expo with --clear.`
      );
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!response.ok) {
    return parseError(response, "Failed to load playlist");
  }

  return (await response.json()) as PlaylistResponse;
}

export interface ChatApiResult {
  response: string;
  playlist: ChatPlaylistSnapshot | null;
}

/** Only role + content are sent to the server (no large playlist blobs in history). */
function historyForApi(history: ChatMessage[]): Pick<ChatMessage, "role" | "content">[] {
  return history.map(({ role, content }) => ({ role, content }));
}

export async function sendChatMessage(
  message: string,
  context: ChatContext,
  history: ChatMessage[]
): Promise<ChatApiResult> {
  const url = `${API_BASE_URL}/api/chat`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, context, history: historyForApi(history) })
    });
  } catch (err) {
    if (isLikelyNetworkFailure(err)) {
      throw new Error(
        `Cannot reach the API at ${API_BASE_URL}. Set EXPO_PUBLIC_API_URL in BingBeats/.env to your deployed backend URL (for example your Render service URL), then restart Expo with --clear.`
      );
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (!response.ok) {
    return parseError(response, "Failed to send chat message");
  }

  const data = (await response.json()) as {
    response?: string;
    playlist?: ChatPlaylistSnapshot | null;
  };
  if (!data.response) {
    throw new Error("Chat response was empty");
  }

  return {
    response: data.response,
    playlist: data.playlist ?? null
  };
}
