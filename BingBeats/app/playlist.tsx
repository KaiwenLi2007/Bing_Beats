import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { Audio, AVPlaybackStatus } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Reanimated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";

import { useCyclingTheme } from "./contexts/CyclingGradientContext";
import { getPlaylist } from "./lib/api";
import { flagEmoji } from "./lib/countries";
import { colors, radii, spacing, typography } from "./lib/theme";
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
      <Animated.View
        style={[
          styles.skeletonIndex,
          {
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.65]
            })
          }
        ]}
      />
      <Animated.View
        style={[
          styles.skeletonArt,
          {
            opacity: shimmer.interpolate({
              inputRange: [0, 1],
              outputRange: [0.35, 0.7]
            })
          }
        ]}
      />
      <View style={styles.skeletonTextArea}>
        <Animated.View style={[styles.skeletonLineWide, { opacity: shimmer }]} />
        <Animated.View style={[styles.skeletonLineNarrow, { opacity: shimmer }]} />
      </View>
      <Animated.View style={[styles.skeletonButton, { opacity: shimmer }]} />
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={12}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
    >
      <Ionicons color={colors.text.primary} name="chevron-back" size={22} />
    </Pressable>
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
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { sound } = await Audio.Sound.createAsync(
        { uri: track.preview_url },
        { progressUpdateIntervalMillis: 500, shouldPlay: true },
        null,
        true
      );

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          setPlayingTrackId(null);
          sound.unloadAsync().catch(() => {});
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

  const heroTitle = `${countryName} · ${selectedYear}`;

  if (loading) {
    return (
      <PlaylistShell>
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
        </View>

        <View style={styles.heroBlock}>
          <Text style={styles.heroFlag}>{flagEmoji(countryCode)}</Text>
          <Text style={styles.heroTitle}>{heroTitle}</Text>
          <Text style={styles.heroMeta}>Finding tracks for this place and year…</Text>
        </View>

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
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.centerBlock}>
          <View style={[styles.stateIconWrap, { borderColor: colors.border.emphasis }]}>
            <Ionicons color={colors.danger} name="alert-circle-outline" size={40} />
          </View>
          <Text style={styles.stateTitle}>Couldn&apos;t load this playlist</Text>
          <Text style={styles.stateBody}>{error}</Text>
          <Pressable
            onPress={loadPlaylist}
            style={[styles.primaryCta, { backgroundColor: cycling.accent }]}
          >
            <Text style={styles.primaryCtaText}>Retry</Text>
          </Pressable>
        </View>
      </PlaylistShell>
    );
  }

  if (!playlist || playlist.tracks.length === 0) {
    return (
      <PlaylistShell>
        <View style={styles.topBar}>
          <BackButton onPress={() => router.back()} />
        </View>
        <View style={styles.centerBlock}>
          <View style={[styles.stateIconWrap, { borderColor: colors.border.subtle }]}>
            <Ionicons color={colors.text.tertiary} name="musical-notes-outline" size={36} />
          </View>
          <Text style={styles.stateTitle}>
            No tracks found for {countryName} in {selectedYear}.
          </Text>
          <Text style={styles.stateBody}>Try another year on the home screen.</Text>
          <Pressable
            onPress={() => router.back()}
            style={[styles.primaryCta, { backgroundColor: cycling.accent }]}
          >
            <Text style={styles.primaryCtaText}>Choose another year</Text>
          </Pressable>
        </View>
      </PlaylistShell>
    );
  }

  const previewCount = playlist.tracks.filter((t) => t.preview_url).length;

  return (
    <PlaylistShell>
      <View style={styles.topBar}>
        <BackButton onPress={() => router.back()} />
      </View>

      <View style={styles.heroBlock}>
        <Reanimated.Text entering={FadeInDown.duration(450).springify()} style={styles.heroFlag}>
          {flagEmoji(countryCode)}
        </Reanimated.Text>
        <Reanimated.Text
          entering={FadeInDown.delay(60).duration(480).springify()}
          style={styles.heroTitle}
        >
          {heroTitle}
        </Reanimated.Text>
        <Reanimated.Text entering={FadeIn.delay(120).duration(380)} style={styles.heroMeta}>
          {playlist.tracks.length} {playlist.tracks.length === 1 ? "track" : "tracks"}
          {previewCount > 0
            ? ` · ${previewCount} with ${previewCount === 1 ? "a preview" : "previews"}`
            : ""}
        </Reanimated.Text>
        <Reanimated.Text entering={FadeIn.delay(200).duration(380)} style={styles.heroHint}>
          Tap a row to play a 30s preview or open in Spotify.
        </Reanimated.Text>
      </View>

      <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
        <Reanimated.View entering={FadeInDown.delay(180).springify()} style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Playlist</Text>
        </Reanimated.View>

        {playlist.tracks.map((track, index) => {
          const hasPreview = Boolean(track.preview_url);
          const isPlaying = playingTrackId === track.id;
          const isBusy = audioBusyId === track.id;

          const openSpotify = () => {
            if (!track.spotify_url) {
              return;
            }
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Linking.openURL(track.spotify_url).catch(() => {
              setError("Could not open Spotify link.");
            });
          };

          return (
            <Reanimated.View
              key={track.id}
              entering={FadeInUp.delay(Math.min(40 + index * 55, 380)).springify()}
              style={styles.trackRowWrap}
            >
              <Pressable
                accessibilityLabel={
                  hasPreview
                    ? `${isPlaying ? "Pause" : "Play"} ${track.name}`
                    : `Open ${track.name} in Spotify`
                }
                accessibilityRole="button"
                disabled={Boolean(hasPreview && isBusy)}
                onPress={() => {
                  if (hasPreview) {
                    void onToggleTrack(track);
                  } else {
                    openSpotify();
                  }
                }}
                style={({ pressed }) => [
                  styles.trackCard,
                  isPlaying && {
                    backgroundColor: cycling.accentDim,
                    borderColor: cycling.accent
                  },
                  !isPlaying && { borderColor: colors.border.subtle },
                  pressed && styles.trackCardPressed
                ]}
              >
                <Text style={styles.trackIndex}>{String(index + 1).padStart(2, "0")}</Text>

                <View style={styles.artWrap}>
                  <Image source={{ uri: track.album_art }} style={styles.albumArt} />
                  {isPlaying ? (
                    <LinearGradient
                      colors={["transparent", "rgba(0,0,0,0.55)"]}
                      style={styles.artGradient}
                    />
                  ) : null}
                </View>

                <View style={styles.trackTextArea}>
                  <Text numberOfLines={2} style={styles.trackName}>
                    {track.name}
                  </Text>
                  <Text numberOfLines={1} style={styles.trackArtist}>
                    {track.artist}
                  </Text>
                </View>

                {hasPreview ? (
                  <View
                    style={[
                      styles.playFab,
                      { backgroundColor: cycling.accent, shadowColor: cycling.accent }
                    ]}
                  >
                    {isBusy ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Ionicons color="#fff" name={isPlaying ? "pause" : "play"} size={20} />
                    )}
                  </View>
                ) : (
                  <View style={styles.spotifyChip}>
                    <Ionicons color={cycling.accent} name="open-outline" size={16} />
                    <Text style={[styles.spotifyChipText, { color: cycling.accent }]}>Spotify</Text>
                  </View>
                )}
              </Pressable>
            </Reanimated.View>
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
    paddingHorizontal: spacing.base
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.xs
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.bg.elevated,
    borderColor: colors.border.subtle,
    borderRadius: radii.full,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40
  },
  backButtonPressed: {
    opacity: 0.85
  },
  heroBlock: {
    marginTop: spacing.md
  },
  heroFlag: {
    fontSize: 48,
    lineHeight: 56
  },
  heroTitle: {
    ...typography.title,
    letterSpacing: -0.3,
    marginTop: spacing.sm
  },
  heroMeta: {
    ...typography.subtitle,
    marginTop: spacing.sm
  },
  heroHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.sm
  },
  centerBlock: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.base
  },
  stateIconWrap: {
    alignItems: "center",
    borderRadius: radii.full,
    borderWidth: 1,
    height: 80,
    justifyContent: "center",
    marginBottom: spacing.lg,
    width: 80
  },
  stateTitle: {
    ...typography.heading,
    textAlign: "center"
  },
  stateBody: {
    ...typography.subtitle,
    marginTop: spacing.sm,
    textAlign: "center"
  },
  primaryCta: {
    alignItems: "center",
    borderRadius: radii.md,
    justifyContent: "center",
    marginTop: spacing.xl,
    minHeight: 48,
    minWidth: 200,
    paddingHorizontal: spacing.lg
  },
  primaryCtaText: {
    ...typography.button,
    fontWeight: "700"
  },
  listScroll: {
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.text.secondary
  },
  trackRowWrap: {
    width: "100%"
  },
  listArea: {
    gap: spacing.md,
    paddingTop: spacing.lg
  },
  skeletonCard: {
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    padding: spacing.md
  },
  skeletonIndex: {
    borderRadius: radii.sm,
    backgroundColor: colors.overlay.white10,
    height: 14,
    width: 22
  },
  skeletonArt: {
    borderRadius: radii.md,
    backgroundColor: colors.overlay.white20,
    height: 72,
    marginLeft: spacing.sm,
    width: 72
  },
  skeletonTextArea: {
    flex: 1,
    marginLeft: spacing.md
  },
  skeletonLineWide: {
    backgroundColor: colors.overlay.white20,
    borderRadius: radii.sm,
    height: 12,
    width: "78%"
  },
  skeletonLineNarrow: {
    backgroundColor: colors.overlay.white10,
    borderRadius: radii.sm,
    height: 10,
    marginTop: spacing.sm,
    width: "52%"
  },
  skeletonButton: {
    backgroundColor: colors.overlay.white10,
    borderRadius: radii.full,
    height: 44,
    marginLeft: spacing.sm,
    width: 44
  },
  trackCard: {
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: spacing.md,
    padding: spacing.md,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10
      }
    })
  },
  trackCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }]
  },
  trackIndex: {
    ...typography.micro,
    color: colors.text.tertiary,
    fontVariant: ["tabular-nums"],
    minWidth: 22
  },
  artWrap: {
    borderRadius: radii.md,
    marginLeft: spacing.sm,
    overflow: "hidden"
  },
  albumArt: {
    backgroundColor: colors.muted.buttonBg,
    borderRadius: radii.md,
    height: 72,
    width: 72
  },
  artGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.md
  },
  trackTextArea: {
    flex: 1,
    marginLeft: spacing.md,
    minWidth: 0
  },
  trackName: {
    ...typography.heading,
    fontSize: 16,
    lineHeight: 21
  },
  trackArtist: {
    ...typography.caption,
    marginTop: 4
  },
  playFab: {
    alignItems: "center",
    borderRadius: radii.full,
    height: 44,
    justifyContent: "center",
    marginLeft: spacing.sm,
    width: 44,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6
      },
      android: { elevation: 4 }
    })
  },
  spotifyChip: {
    alignItems: "center",
    backgroundColor: colors.bg.elevated,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    marginLeft: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  spotifyChipText: {
    fontSize: 13,
    fontWeight: "700"
  }
});
