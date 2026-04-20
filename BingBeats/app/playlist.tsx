import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCyclingTheme } from "./contexts/CyclingGradientContext";
import { getPlaylist } from "./lib/api";
import { flagEmoji } from "./lib/countries";
import { colors } from "./lib/theme";
import type { Track } from "./lib/types";

/** Full-screen cycling gradient + safe area (matches home). */
function PlaylistShell({ children }: { children: ReactNode }) {
  const cycling = useCyclingTheme();
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[cycling.gradientTop, cycling.gradientBottom]}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
        <View style={styles.container}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

interface PlaylistState {
  country_code: string;
  year: number;
  tracks: Track[];
}

function SkeletonCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <View style={styles.skeletonCard}>
      <Animated.View style={[styles.skeletonArt, { opacity: shimmer.interpolate({
        inputRange: [0, 1],
        outputRange: [0.35, 0.7]
      }) }]} />
      <View style={styles.skeletonTextArea}>
        <Animated.View style={[styles.skeletonLineWide, { opacity: shimmer }]} />
        <Animated.View style={[styles.skeletonLineNarrow, { opacity: shimmer }]} />
      </View>
      <Animated.View style={[styles.skeletonButton, { opacity: shimmer }]} />
    </View>
  );
}

export default function PlaylistScreen() {
  const router = useRouter();
  const cycling = useCyclingTheme();
  const { code, name, year } = useLocalSearchParams<{
    code?: string;
    name?: string;
    year?: string;
  }>();

  const countryCode = useMemo(() => (code ? String(code).toUpperCase() : ""), [code]);
  const countryName = useMemo(() => (name ? String(name) : "Unknown"), [name]);
  const selectedYear = useMemo(() => Number(year || 0), [year]);

  const [playlist, setPlaylist] = useState<PlaylistState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [audioBusyId, setAudioBusyId] = useState<string | null>(null);

  const activeSoundRef = useRef<Audio.Sound | null>(null);

  const stopAndUnloadCurrent = useCallback(async () => {
    if (!activeSoundRef.current) {
      return;
    }

    try {
      await activeSoundRef.current.stopAsync();
      await activeSoundRef.current.unloadAsync();
    } catch {
      // Ignore sound cleanup errors.
    }

    activeSoundRef.current = null;
    setPlayingTrackId(null);
  }, []);

  const loadPlaylist = useCallback(async () => {
    if (!countryCode || !selectedYear) {
      setError("Missing country or year. Go back and try again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getPlaylist(countryCode, selectedYear);
      setPlaylist(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load playlist.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [countryCode, selectedYear]);

  useEffect(() => {
    loadPlaylist();
  }, [loadPlaylist]);

  useEffect(() => {
    // Ensure all sounds are released when leaving the screen.
    return () => {
      stopAndUnloadCurrent();
    };
  }, [stopAndUnloadCurrent]);

  async function onToggleTrack(track: Track) {
    if (!track.preview_url) {
      return;
    }

    setAudioBusyId(track.id);

    try {
      if (playingTrackId === track.id && activeSoundRef.current) {
        await stopAndUnloadCurrent();
        return;
      }

      await stopAndUnloadCurrent();

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.preview_url },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }

        // Reset UI when the 30s preview ends naturally.
        if (status.didJustFinish) {
          setPlayingTrackId(null);
          sound.unloadAsync().catch(() => {
            // Ignore unload errors.
          });
          if (activeSoundRef.current === sound) {
            activeSoundRef.current = null;
          }
        }
      });

      activeSoundRef.current = sound;
      setPlayingTrackId(track.id);
    } catch {
      setError("Could not play preview audio. Please try another track.");
    } finally {
      setAudioBusyId(null);
    }
  }

  if (loading) {
    return (
      <PlaylistShell>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>

        <Text style={styles.headerFlag}>{flagEmoji(countryCode)}</Text>
        <Text style={styles.headerTitle}>
          {countryName} · {selectedYear}
        </Text>
        <Text style={styles.loadingHint}>Loading tracks... this can take a bit on cold start.</Text>

        <View style={styles.listArea}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </PlaylistShell>
    );
  }

  if (error) {
    return (
      <PlaylistShell>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.errorTitle}>Couldn&apos;t load this playlist</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          onPress={loadPlaylist}
          style={[styles.retryButton, { backgroundColor: cycling.accent }]}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </Pressable>
      </PlaylistShell>
    );
  }

  if (!playlist || playlist.tracks.length === 0) {
    return (
      <PlaylistShell>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        </View>
        <Text style={styles.emptyTitle}>
          No tracks found for {countryName} in {selectedYear}.
        </Text>
        <Text style={styles.emptyText}>Try a different year!</Text>
        <Pressable
          onPress={() => router.back()}
          style={[styles.retryButton, { backgroundColor: cycling.accent }]}
        >
          <Text style={styles.retryButtonText}>Choose Another Year</Text>
        </Pressable>
      </PlaylistShell>
    );
  }

  return (
    <PlaylistShell>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>
      </View>

      <Text style={styles.headerFlag}>{flagEmoji(countryCode)}</Text>
      <Text style={styles.headerTitle}>
        {countryName} · {selectedYear}
      </Text>

      <ScrollView contentContainerStyle={styles.listArea} showsVerticalScrollIndicator={false}>
        {playlist.tracks.map((track) => {
          const hasPreview = Boolean(track.preview_url);
          const isPlaying = playingTrackId === track.id;
          const isBusy = audioBusyId === track.id;

          return (
            <View key={track.id} style={styles.trackCard}>
              <Image source={{ uri: track.album_art }} style={styles.albumArt} />

              <View style={styles.trackTextArea}>
                <Text numberOfLines={1} style={styles.trackName}>
                  {track.name}
                </Text>
                <Text numberOfLines={1} style={styles.trackArtist}>
                  {track.artist}
                </Text>
              </View>

              {hasPreview ? (
                <Pressable
                  disabled={isBusy}
                  onPress={() => onToggleTrack(track)}
                  style={[styles.iconButton, { backgroundColor: cycling.accent }]}
                >
                  {isBusy ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.iconButtonText}>{isPlaying ? "⏸" : "▶"}</Text>
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    // Route users to Spotify when no preview is available.
                    void import("react-native").then(({ Linking }) => {
                      Linking.openURL(track.spotify_url).catch(() => {
                        setError("Could not open Spotify link.");
                      });
                    });
                  }}
                  style={styles.spotifyLinkButton}
                >
                  <Text style={[styles.spotifyLinkText, { color: cycling.accent }]}>Spotify ↗</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
    </PlaylistShell>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg.primary,
    flex: 1
  },
  safe: {
    backgroundColor: "transparent",
    flex: 1
  },
  container: {
    flex: 1,
    paddingHorizontal: 16
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginTop: 4
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 10
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "600"
  },
  headerFlag: {
    fontSize: 44,
    marginTop: 10
  },
  headerTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    marginTop: 8
  },
  loadingHint: {
    color: "#a0a0a0",
    marginTop: 8
  },
  listArea: {
    paddingTop: 16,
    paddingBottom: 20,
    gap: 12
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 12
  },
  skeletonArt: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#2c2c2c"
  },
  skeletonTextArea: {
    flex: 1,
    marginLeft: 12
  },
  skeletonLineWide: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "#2f2f2f",
    width: "80%"
  },
  skeletonLineNarrow: {
    height: 10,
    borderRadius: 8,
    backgroundColor: "#2a2a2a",
    width: "55%",
    marginTop: 10
  },
  skeletonButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2b2b2b"
  },
  errorTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 26
  },
  errorText: {
    color: "#a0a0a0",
    marginTop: 10
  },
  retryButton: {
    alignItems: "center",
    borderRadius: 12,
    justifyContent: "center",
    marginTop: 18,
    minHeight: 48
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  emptyTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    marginTop: 26
  },
  emptyText: {
    color: "#a0a0a0",
    marginTop: 8
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 12
  },
  albumArt: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#2a2a2a"
  },
  trackTextArea: {
    flex: 1,
    marginLeft: 12
  },
  trackName: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  },
  trackArtist: {
    color: "#a0a0a0",
    fontSize: 14,
    marginTop: 4
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  iconButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700"
  },
  spotifyLinkButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#232323"
  },
  spotifyLinkText: {
    fontSize: 13,
    fontWeight: "700"
  }
});
