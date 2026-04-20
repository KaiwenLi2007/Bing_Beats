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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  country: string;
  country_code: string;
  year: number;
  current_tracks: string[];
}
