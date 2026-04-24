import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import {
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import Reanimated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCyclingTheme } from "../contexts/CyclingGradientContext";
import { useDiscovery } from "../contexts/DiscoveryContext";
import { Globe } from "../components/Globe";
import { COUNTRIES, flagEmoji, type CountryOption } from "../lib/countries";
import { hslToHex } from "../lib/rainbowColors";
import { colors, radii, spacing, typography } from "../lib/theme";

const MIN_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();

type CountryViewMode = "featured" | "globe";

/** Gentle vertical drift on the tagline (continuous, low amplitude). */
function FloatingSubtitle({ style, children }: { children: string; style: TextStyle }) {
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 2200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [y]);

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }]
  }));

  return (
    <Reanimated.Text
      entering={FadeInDown.delay(140).duration(480).springify()}
      style={[style, drift]}
    >
      {children}
    </Reanimated.Text>
  );
}

/** Subtle scale pop when the year value changes (slider). */
function PoppingYear({
  textStyle,
  value
}: {
  textStyle: StyleProp<TextStyle>;
  value: number;
}) {
  const scale = useSharedValue(1);
  const didMount = useRef(false);

  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    scale.value = withSequence(
      withSpring(1.07, { damping: 14, stiffness: 260 }),
      withSpring(1, { damping: 16, stiffness: 220 })
    );
  }, [value, scale]);

  const pop = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Reanimated.Text style={[textStyle, pop]}>{String(value)}</Reanimated.Text>
  );
}

const WORD_FIRST = "Bing";
const WORD_SECOND = "Beats";

/** One letter: staggered entrance; colour comes from a single accent half (“Beats”), not a rainbow. */
function PlayfulLetter({
  accent,
  accentColor,
  index,
  letter
}: {
  accent: boolean;
  accentColor: string;
  index: number;
  letter: string;
}) {
  return (
    <Reanimated.Text
      entering={FadeInDown.delay(38 * index).duration(420).springify()}
      style={[
        styles.playfulLetter,
        accent ? { color: accentColor } : styles.playfulLetterIce,
        accent && styles.playfulLetterAccentWeight
      ]}
    >
      {letter}
    </Reanimated.Text>
  );
}

/** Bold two-beat wordmark: cool “Bing”, one hot “Beats” + accent dot — minimal colour, strong type. */
function PlayfulWordmark() {
  const cycling = useCyclingTheme();
  const dotPulse = useSharedValue(1);

  useEffect(() => {
    dotPulse.value = withRepeat(
      withSequence(
        withSpring(1.1, { damping: 12, stiffness: 180 }),
        withSpring(1, { damping: 14, stiffness: 200 })
      ),
      -1,
      true
    );
  }, [dotPulse]);

  const dotBounce = useAnimatedStyle(() => ({
    transform: [{ scale: dotPulse.value }]
  }));

  const accent = cycling.accent;
  const first = WORD_FIRST.split("");
  const second = WORD_SECOND.split("");

  return (
    <View style={styles.wordmarkRow}>
      <View style={styles.playfulLettersWrap}>
        <View style={styles.playfulWordParts}>
          {first.map((letter, i) => (
            <PlayfulLetter
              key={`b-${i}`}
              accent={false}
              accentColor={accent}
              index={i}
              letter={letter}
            />
          ))}
          <View style={styles.wordmarkGap} />
          {second.map((letter, i) => (
            <PlayfulLetter
              key={`t-${i}`}
              accent
              accentColor={accent}
              index={i + first.length}
              letter={letter}
            />
          ))}
        </View>
      </View>
      <Reanimated.View
        entering={FadeIn.delay(110).duration(380)}
        accessibilityLabel=""
        style={[
          styles.brandDot,
          styles.brandDotPlayful,
          { backgroundColor: accent },
          dotBounce
        ]}
      />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const cycling = useCyclingTheme();
  const { height: windowHeight } = useWindowDimensions();
  /** Keep the map compact so the year slider and Discover stay on screen (55% was too tall on phones). */
  const globeHeight = useMemo(() => {
    const raw = Math.round(windowHeight * 0.33);
    return Math.min(Math.max(raw, 196), 280);
  }, [windowHeight]);

  /** Quantize hue so Mapbox injects run ~24× per full spectrum loop (avoids WebView spam). */
  const globeHueBucket = Math.floor(cycling.hue / 15);
  const globeAccent = useMemo(() => hslToHex(globeHueBucket * 15, 88, 54), [globeHueBucket]);

  const [countryViewMode, setCountryViewMode] = useState<CountryViewMode>("featured");
  const {
    country: selectedCountry,
    setCountry: setSelectedCountry,
    year: selectedYear,
    setYear: setSelectedYear
  } = useDiscovery();

  const [segmentWidth, setSegmentWidth] = useState(0);
  const segmentPillX = useRef(new Animated.Value(0)).current;
  const [showChatHint, setShowChatHint] = useState(false);
  const lastHintKeyRef = useRef<string | null>(null);

  const segmentHalfWidth = segmentWidth > 8 ? (segmentWidth - spacing.xs) / 2 : 0;

  useEffect(() => {
    if (segmentWidth < 16) return;
    const targetX = countryViewMode === "featured" ? 0 : segmentHalfWidth;
    Animated.timing(segmentPillX, {
      toValue: targetX,
      duration: 200,
      useNativeDriver: true
    }).start();
  }, [countryViewMode, segmentWidth, segmentHalfWidth, segmentPillX]);

  /** Check if the user has selected a country and year. */
  const canDiscover = useMemo(() => {
    return Boolean(selectedCountry && selectedYear);
  }, [selectedCountry, selectedYear]);

  /** Show a hint to the user to open the chatbox. */
  useEffect(() => {
    if (!selectedCountry || !selectedYear) {
      setShowChatHint(false);
      return;
    }

    
    const hintKey = `${selectedCountry.code}-${selectedYear}`;
    if (lastHintKeyRef.current === hintKey) {
      return;
    }

    lastHintKeyRef.current = hintKey;
    setShowChatHint(true);

    /** Close the hint after 6.5 seconds. */
    const timer = setTimeout(() => {
      setShowChatHint(false);
    }, 6500);

    return () => clearTimeout(timer);
  }, [selectedCountry, selectedYear]);


  /** Handle the country press event. */
  function handleCountryPress(country: CountryOption) {
    setSelectedCountry(country);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  function handleGlobeCountrySelect(isoCode: string, countryName: string) {
    const match = COUNTRIES.find((c) => c.code === isoCode);
    if (match) {
      setSelectedCountry(match);
    } else {
      setSelectedCountry({
        code: isoCode,
        name: countryName,
        flag: flagEmoji(isoCode)
      });
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  function handleDiscover() {
    if (!selectedCountry || !selectedYear) {
      return;
    }

    router.push({
      pathname: "/playlist",
      params: {
        code: selectedCountry.code,
        name: selectedCountry.name,
        year: String(selectedYear)
      }
    });
  }

  const yearDisplay = selectedYear ?? CURRENT_YEAR;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[cycling.gradientTop, cycling.gradientBottom]}
        end={{ x: 0.5, y: 1 }}
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.container}>
        <View style={styles.headerBlock}>
          <PlayfulWordmark />
          <FloatingSubtitle style={styles.subtitle}>
            Discover music across time and space
          </FloatingSubtitle>
        </View>

        <Reanimated.View
          entering={FadeInDown.delay(200).duration(450).springify()}
          style={styles.segmentShell}
          onLayout={(e) => setSegmentWidth(e.nativeEvent.layout.width)}
        >
          {segmentHalfWidth > 0 ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.segmentPill,
                { backgroundColor: cycling.accent },
                {
                  width: segmentHalfWidth,
                  transform: [{ translateX: segmentPillX }]
                }
              ]}
            />
          ) : null}
          <View style={styles.segmentRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCountryViewMode("featured")}
              style={({ pressed }) => [styles.segmentHit, pressed && styles.segmentHitPressed]}
            >
              <Text
                style={[
                  styles.segmentText,
                  countryViewMode === "featured" ? styles.segmentTextOn : styles.segmentTextOff
                ]}
                numberOfLines={1}
              >
                Featured countries
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCountryViewMode("globe")}
              style={({ pressed }) => [styles.segmentHit, pressed && styles.segmentHitPressed]}
            >
              <Text
                style={[
                  styles.segmentText,
                  countryViewMode === "globe" ? styles.segmentTextOn : styles.segmentTextOff
                ]}
                numberOfLines={1}
              >
                Globe
              </Text>
            </Pressable>
          </View>
        </Reanimated.View>

        {countryViewMode === "featured" ? (
          <FlatList
            columnWrapperStyle={styles.countryRow}
            contentContainerStyle={styles.countryListContent}
            data={COUNTRIES}
            keyExtractor={(item) => item.code}
            numColumns={3}
            renderItem={({ item }) => {
              const isSelected = selectedCountry?.code === item.code;
              return (
                <Pressable
                  onPress={() => handleCountryPress(item)}
                  style={({ pressed }) => [
                    styles.countryCard,
                    isSelected && {
                      backgroundColor: cycling.accentDim,
                      borderColor: cycling.accent,
                      borderWidth: 2
                    },
                    pressed && styles.countryCardPressed
                  ]}
                >
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text style={styles.countryName} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
            showsVerticalScrollIndicator={false}
            style={styles.countryList}
          />
        ) : (
          <View style={[styles.globeSection, { height: globeHeight }]}>
            <LinearGradient
              colors={[cycling.glow, colors.bg.primary]}
              end={{ x: 0.5, y: 1 }}
              start={{ x: 0.5, y: 0.35 }}
              style={styles.globeGlow}
            />
            {/* Inset map so the wash remains visible as a subtle ring (not covered by opaque WebView). */}
            <View style={styles.globeInner}>
              <Globe
                accentColor={globeAccent}
                height={globeHeight - spacing.base * 2}
                onCountrySelect={handleGlobeCountrySelect}
                selectedCountryCode={selectedCountry?.code ?? null}
              />
            </View>
          </View>
        )}

        <Reanimated.View
          entering={FadeInUp.delay(260).duration(480).springify()}
          style={styles.yearBlock}
        >
          {countryViewMode === "globe" ? (
            <View style={styles.yearGlobeRow}>
              <View style={styles.yearGlobeYearCol}>
                <PoppingYear textStyle={styles.yearHeroGlobeCompact} value={yearDisplay} />
                <Reanimated.Text entering={FadeIn.delay(40)} style={styles.yearMicro}>
                  Year
                </Reanimated.Text>
              </View>
              <View style={styles.yearGlobeCountryCol}>
                {selectedCountry ? (
                  <Reanimated.View
                    key={selectedCountry.code}
                    entering={FadeIn.duration(320).springify()}
                    style={styles.globeCountryAnimated}
                  >
                    <Text style={styles.globeSelectedFlag} numberOfLines={1}>
                      {selectedCountry.flag}
                    </Text>
                    <Text style={styles.globeSelectedName} numberOfLines={2}>
                      {selectedCountry.name}
                    </Text>
                  </Reanimated.View>
                ) : (
                  <Reanimated.Text
                    entering={FadeIn.duration(280)}
                    style={styles.globeSelectHint}
                  >
                    Tap the map to choose a country
                  </Reanimated.Text>
                )}
              </View>
            </View>
          ) : (
            <>
              <PoppingYear textStyle={styles.yearHero} value={yearDisplay} />
              <Reanimated.Text entering={FadeIn.delay(40)} style={styles.yearMicro}>
                Year
              </Reanimated.Text>
            </>
          )}
        </Reanimated.View>

        <Slider
          maximumTrackTintColor={colors.overlay.white10}
          maximumValue={CURRENT_YEAR}
          minimumTrackTintColor={cycling.accent}
          minimumValue={MIN_YEAR}
          onValueChange={(value) => setSelectedYear(Math.round(value))}
          step={1}
          style={styles.slider}
          thumbTintColor={colors.text.primary}
          value={yearDisplay}
        />
        <Reanimated.View entering={FadeIn.delay(300).duration(400)} style={styles.yearRangeRow}>
          <Text style={styles.yearRangeEnd}>{MIN_YEAR}</Text>
          <Text style={styles.yearRangeEnd}>{CURRENT_YEAR}</Text>
        </Reanimated.View>

        {showChatHint && canDiscover ? (
          <Reanimated.View entering={FadeInUp.duration(300)} style={styles.chatHintCard}>
            <View style={styles.chatHintRow}>
              <View style={[styles.chatHintIconWrap, { backgroundColor: cycling.accentDim }]}>
                <Ionicons color={cycling.accent} name="chatbubbles" size={16} />
              </View>
              <View style={styles.chatHintCopy}>
                <Text style={styles.chatHintTitle}>Playlist tip</Text>
                <Text style={styles.chatHintText}>Open chat and type `/playlist` for instant picks.</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowChatHint(false)}
              style={({ pressed }) => [styles.chatHintDismiss, pressed && styles.chatHintDismissPressed]}
            >
              <Text style={styles.chatHintDismissText}>Got it</Text>
            </Pressable>
          </Reanimated.View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canDiscover}
          onPress={handleDiscover}
          style={({ pressed }) => [
            styles.discoverButton,
            canDiscover && { backgroundColor: cycling.accent },
            !canDiscover && styles.discoverButtonDisabled,
            pressed && canDiscover && styles.discoverButtonPressed
          ]}
        >
          <Reanimated.Text
            entering={FadeInUp.delay(320).duration(450).springify()}
            style={[styles.discoverLabel, !canDiscover && styles.discoverLabelDisabled]}
            numberOfLines={1}
          >
            Discover music
          </Reanimated.Text>
          <Reanimated.View entering={FadeIn.delay(380)}>
            <Ionicons
              color={canDiscover ? colors.text.primary : colors.text.tertiary}
              name="chevron-forward"
              size={20}
            />
          </Reanimated.View>
        </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg.primary
  },
  safe: {
    backgroundColor: "transparent",
    flex: 1
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl
  },
  headerBlock: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl
  },
  wordmarkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  playfulLettersWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0
  },
  playfulWordParts: {
    alignItems: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 2
  },
  wordmarkGap: {
    width: spacing.sm
  },
  playfulLetter: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1.05,
    lineHeight: 44,
    marginRight: 0.5
  },
  playfulLetterIce: {
    color: colors.text.primary,
    ...Platform.select({
      ios: {
        textShadowColor: "rgba(0, 0, 0, 0.4)",
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 14
      },
      default: {}
    })
  },
  playfulLetterAccentWeight: {
    fontWeight: "900"
  },
  brandDot: {
    borderRadius: radii.full,
    height: spacing.sm,
    width: spacing.sm
  },
  brandDotPlayful: {
    height: 11,
    width: 11
  },
  subtitle: {
    ...typography.subtitle,
    marginTop: spacing.sm
  },
  /** Pill container — surface track; sliding green pill is animated behind labels. */
  segmentShell: {
    alignSelf: "center",
    backgroundColor: colors.bg.surface,
    borderRadius: radii.full,
    marginBottom: spacing.base,
    overflow: "hidden",
    padding: spacing.xs,
    position: "relative",
    width: "100%",
    maxWidth: 360
  },
  segmentPill: {
    borderRadius: radii.full,
    height: 40,
    left: spacing.xs,
    position: "absolute",
    top: spacing.xs
  },
  segmentRow: {
    flexDirection: "row",
    zIndex: 1
  },
  segmentHit: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingVertical: spacing.sm
  },
  segmentHitPressed: {
    opacity: 0.92
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center"
  },
  segmentTextOn: {
    color: colors.text.primary
  },
  segmentTextOff: {
    color: colors.text.secondary
  },
  countryList: {
    flex: 1,
    marginBottom: spacing.sm,
    minHeight: 0
  },
  countryListContent: {
    paddingBottom: spacing.md
  },
  countryRow: {
    gap: spacing.sm,
    marginBottom: spacing.sm
  },
  countryCard: {
    alignItems: "center",
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 104,
    padding: spacing.base
  },
  countryCardPressed: {
    transform: [{ scale: 0.96 }]
  },
  countryFlag: {
    fontSize: 40,
    marginBottom: spacing.sm
  },
  countryName: {
    ...typography.flagLabel,
    textAlign: "center"
  },
  globeSection: {
    borderColor: colors.border.subtle,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: "hidden",
    position: "relative",
    width: "100%"
  },
  globeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radii.lg
  },
  globeInner: {
    bottom: spacing.base,
    left: spacing.base,
    overflow: "hidden",
    position: "absolute",
    right: spacing.base,
    top: spacing.base,
    borderRadius: radii.md
  },
  yearBlock: {
    alignItems: "center",
    marginTop: spacing.md,
    width: "100%"
  },
  yearGlobeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    width: "100%"
  },
  yearGlobeYearCol: {
    alignItems: "flex-start",
    flexShrink: 0
  },
  yearGlobeCountryCol: {
    alignItems: "flex-end",
    flex: 1,
    justifyContent: "center",
    minWidth: 0
  },
  yearHeroGlobeCompact: {
    ...typography.yearHero,
    fontSize: 56,
    letterSpacing: -2,
    lineHeight: 60
  },
  globeSelectedFlag: {
    fontSize: 28,
    lineHeight: 32,
    textAlign: "right"
  },
  globeSelectedName: {
    ...typography.heading,
    fontSize: 15,
    marginTop: 2,
    textAlign: "right"
  },
  globeCountryAnimated: {
    alignItems: "flex-end",
    maxWidth: "100%"
  },
  globeSelectHint: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: "right"
  },
  yearHero: {
    ...typography.yearHero,
    textAlign: "center"
  },
  yearMicro: {
    ...typography.micro,
    marginTop: spacing.xs
  },
  slider: {
    marginTop: spacing.sm,
    width: "100%"
  },
  yearRangeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs
  },
  yearRangeEnd: {
    ...typography.caption,
    color: colors.text.tertiary,
    fontSize: 13
  },
  chatHintCard: {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.base,
    padding: spacing.md
  },
  chatHintRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  chatHintIconWrap: {
    alignItems: "center",
    borderRadius: radii.full,
    height: 28,
    justifyContent: "center",
    width: 28
  },
  chatHintCopy: {
    flex: 1,
    minWidth: 0
  },
  chatHintTitle: {
    ...typography.subtitle,
    fontSize: 13
  },
  chatHintText: {
    ...typography.caption,
    marginTop: 2
  },
  chatHintDismiss: {
    alignSelf: "flex-end",
    marginTop: spacing.sm
  },
  chatHintDismissPressed: {
    opacity: 0.86
  },
  chatHintDismissText: {
    ...typography.caption,
    color: colors.text.secondary
  },
  discoverButton: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    height: 56,
    justifyContent: "center",
    marginTop: "auto",
    paddingHorizontal: spacing.lg
  },
  discoverButtonDisabled: {
    backgroundColor: colors.muted.buttonBg
  },
  discoverButtonPressed: {
    transform: [{ scale: 0.98 }]
  },
  discoverLabel: {
    ...typography.button,
    flexShrink: 1
  },
  discoverLabelDisabled: {
    color: colors.text.tertiary
  }
});
