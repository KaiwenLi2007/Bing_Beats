import type { ChatContext, ChatMessage, PlaylistResponse } from "./types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function parseError(response: Response, fallbackMessage: string): Promise<never> {
  try {
    const data = (await response.json()) as { error?: string };
    throw new Error(data.error || `${fallbackMessage} (${response.status})`);
  } catch {
    throw new Error(`${fallbackMessage} (${response.status})`);
  }
}

export async function getPlaylist(
  country_code: string,
  year: number
): Promise<PlaylistResponse> {
  const response = await fetch(`${API_BASE_URL}/api/playlist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ country_code, year })
  });

  if (!response.ok) {
    return parseError(response, "Failed to load playlist");
  }

  return (await response.json()) as PlaylistResponse;
}

export async function sendChatMessage(
  message: string,
  context: ChatContext,
  history: ChatMessage[]
): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message, context, history })
  });

  if (!response.ok) {
    return parseError(response, "Failed to send chat message");
  }

  const data = (await response.json()) as { response?: string };
  if (!data.response) {
    throw new Error("Chat response was empty");
  }

  return data.response;
}
