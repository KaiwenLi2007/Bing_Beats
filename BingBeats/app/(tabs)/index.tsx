import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View
} from "react-native";
import Slider from "@react-native-community/slider";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCyclingTheme } from "../contexts/CyclingGradientContext";
import { Globe } from "../components/Globe";
import { COUNTRIES, flagEmoji, type CountryOption } from "../lib/countries";
import { hslToHex } from "../lib/rainbowColors";
import { colors, radii, spacing, typography } from "../lib/theme";

const MIN_YEAR = 1950;
const CURRENT_YEAR = new Date().getFullYear();

type CountryViewMode = "featured" | "globe";

export default function HomeScreen() {
  const router = useRouter();
  const cycling = useCyclingTheme();
  const { height: windowHeight } = useWindowDimensions();
  const globeHeight = Math.round(windowHeight * 0.55);

  /** Quantize hue so Mapbox injects run ~24× per full spectrum loop (avoids WebView spam). */
  const globeHueBucket = Math.floor(cycling.hue / 15);
  const globeAccent = useMemo(() => hslToHex(globeHueBucket * 15, 88, 54), [globeHueBucket]);

  const [countryViewMode, setCountryViewMode] = useState<CountryViewMode>("featured");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [segmentWidth, setSegmentWidth] = useState(0);
  const segmentPillX = useRef(new Animated.Value(0)).current;

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

  const canDiscover = useMemo(() => {
    return Boolean(selectedCountry && selectedYear);
  }, [selectedCountry, selectedYear]);

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
          <View style={styles.wordmarkRow}>
            <Text style={styles.displayTitle}>BingBeats</Text>
            <View style={[styles.brandDot, { backgroundColor: cycling.accent }]} accessibilityLabel="" />
          </View>
          <Text style={styles.subtitle}>Discover music across time and space</Text>
        </View>

        <View
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
        </View>

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

        <View style={styles.yearBlock}>
          <Text style={styles.yearHero}>{yearDisplay}</Text>
          <Text style={styles.yearMicro}>Year</Text>
        </View>

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
        <View style={styles.yearRangeRow}>
          <Text style={styles.yearRangeEnd}>{MIN_YEAR}</Text>
          <Text style={styles.yearRangeEnd}>{CURRENT_YEAR}</Text>
        </View>

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
          <Text
            style={[styles.discoverLabel, !canDiscover && styles.discoverLabelDisabled]}
            numberOfLines={1}
          >
            Discover music
          </Text>
          <Ionicons
            color={canDiscover ? colors.text.primary : colors.text.tertiary}
            name="chevron-forward"
            size={20}
          />
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  displayTitle: {
    ...typography.display
  },
  brandDot: {
    borderRadius: radii.full,
    height: spacing.sm,
    width: spacing.sm
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
    marginTop: spacing.md
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
