import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { paletteFromHue, type CyclingPalette } from "../lib/rainbowColors";

type CyclingThemeValue = CyclingPalette & {
  /** Current hue 0–360 (for advanced use). */
  hue: number;
};

const CyclingGradientContext = createContext<CyclingThemeValue | null>(null);

const HUE_STEP = 1.2;
const TICK_MS = 40;

/**
 * Smoothly advances hue so the full spectrum loops continuously (~12s per full cycle at defaults).
 */
export function CyclingGradientProvider({ children }: { children: ReactNode }) {
  const [hue, setHue] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setHue((prev) => (prev + HUE_STEP) % 360);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const value = useMemo((): CyclingThemeValue => {
    return {
      hue,
      ...paletteFromHue(hue)
    };
  }, [hue]);

  return <CyclingGradientContext.Provider value={value}>{children}</CyclingGradientContext.Provider>;
}

export function useCyclingTheme(): CyclingThemeValue {
  const ctx = useContext(CyclingGradientContext);
  if (!ctx) {
    throw new Error("useCyclingTheme must be used within CyclingGradientProvider");
  }
  return ctx;
}
