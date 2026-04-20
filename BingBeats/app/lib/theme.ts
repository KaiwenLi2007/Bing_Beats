/**
 * BingBeats design tokens — single source of truth for colors, type, spacing, and radii.
 * Import from `app/lib/theme` in screens and components (Steps 2–4 will wire these up).
 */

import type { TextStyle } from "react-native";

// --- Colors (dark music-app aesthetic) ---

export const colors = {
  bg: {
    primary: "#0a0a0a",
    surface: "#161616",
    elevated: "#1f1f1f"
  },
  border: {
    subtle: "rgba(255, 255, 255, 0.08)",
    emphasis: "rgba(255, 255, 255, 0.16)"
  },
  accent: {
    DEFAULT: "#1DB954",
    hover: "#1ed760",
    dim: "rgba(29, 185, 84, 0.15)"
  },
  text: {
    primary: "#ffffff",
    secondary: "#a7a7a7",
    tertiary: "#6a6a6a"
  },
  danger: "#ff5c5c",
  /** Disabled / inactive surfaces (buttons, inputs). */
  muted: {
    buttonBg: "#2a2a2a"
  },
  /** Skeleton / progress track backgrounds. */
  overlay: {
    white10: "rgba(255, 255, 255, 0.1)",
    white20: "rgba(255, 255, 255, 0.2)"
  }
} as const;

// --- Spacing (multiples of 4 only) ---

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48
} as const;

// --- Radii ---

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  full: 9999
} as const;

/**
 * Typography presets (system font). Use with <Text style={…}>.
 * letterSpacing: RN uses px; em-like values are derived from fontSize where noted.
 */
export const typography = {
  /** Hero wordmark — 36px, -0.02em → -0.72px */
  display: {
    fontSize: 36,
    fontWeight: "700",
    letterSpacing: -0.72,
    color: colors.text.primary
  } satisfies TextStyle,
  /** Section titles — 24px */
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text.primary
  } satisfies TextStyle,
  /** Subheads / modal titles — 18px */
  heading: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text.primary
  } satisfies TextStyle,
  /** Body copy — 15px */
  body: {
    fontSize: 15,
    fontWeight: "400",
    color: colors.text.primary
  } satisfies TextStyle,
  /** Secondary meta — 13px */
  caption: {
    fontSize: 13,
    fontWeight: "400",
    color: colors.text.secondary
  } satisfies TextStyle,
  /** Home subtitle — 14px secondary (between caption and body). */
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: colors.text.secondary
  } satisfies TextStyle,
  /** Micro labels — 11px uppercase */
  micro: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.44,
    color: colors.text.tertiary,
    textTransform: "uppercase" as const
  } satisfies TextStyle,
  /** Home year hero number — 72px, -0.04em */
  yearHero: {
    fontSize: 72,
    fontWeight: "800",
    letterSpacing: -2.88,
    color: colors.text.primary
  } satisfies TextStyle,
  /** Discover CTA — 16px semibold */
  button: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary
  } satisfies TextStyle,
  /** Flag grid country name — 13px medium */
  flagLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text.primary
  } satisfies TextStyle
} as const;

/** FAB: only place we use a soft colored shadow (per design system). */
export const shadows = {
  fab: {
    shadowColor: "#1DB954",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  }
} as const;

/** Re-export for quick access to palette in non-Text contexts. */
export const theme = {
  colors,
  spacing,
  radii,
  typography,
  shadows
} as const;

export type ThemeColors = typeof colors;
export type ThemeSpacing = typeof spacing;
