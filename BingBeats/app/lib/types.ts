export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_art: string;
  preview_url: string | null;
  spotify_url: string;
  release_date: string;
}

export interface PlaylistResponse {
  country_code: string;
  year: number;
  tracks: Track[];
}

/** Tracks returned with a chat reply so the UI can mirror the in-app playlist. */
export interface ChatPlaylistSnapshot {
  country_code: string;
  year: number;
  country_name: string;
  tracks: Track[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Present on assistant messages when the server attached a catalog playlist. */
  playlist?: ChatPlaylistSnapshot;
}

export interface ChatContext {
  country: string;
  country_code: string;
  year: number;
  current_tracks: string[];
}
