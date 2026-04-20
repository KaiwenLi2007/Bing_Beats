/**
 * Utilities for a continuously shifting hue — full spectrum loop for UI accents and gradients.
 */

export interface CyclingPalette {
  /** Primary accent (buttons, sliders, highlights). */
  accent: string;
  /** Slightly lighter for hover / emphasis. */
  accentHover: string;
  /** Tinted surface (selected chips, dim fills). */
  accentDim: string;
  /** Top of screen background gradient. */
  gradientTop: string;
  /** Bottom of screen background gradient. */
  gradientBottom: string;
  /** Soft glow (e.g. behind globe ring). */
  glow: string;
}

/** Convert HSL to #rrggbb (h: 0–360, s/l: 0–100). */
export function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hh < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hh < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hh < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hh < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);

  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
}

/** `rgba` of accent at given alpha (for tinted backgrounds). */
export function accentRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Derive all cycling UI colors from a single hue (0–360). */
export function paletteFromHue(hue: number): CyclingPalette {
  const h = ((hue % 360) + 360) % 360;
  const accent = hslToHex(h, 88, 54);
  const accentHover = hslToHex(h, 92, 60);
  const accentDim = accentRgba(accent, 0.15);
  const gradientTop = hslToHex(h, 38, 11);
  const gradientBottom = hslToHex((h + 140) % 360, 36, 9);
  const glow = accentRgba(accent, 0.12);
  return {
    accent,
    accentHover,
    accentDim,
    gradientTop,
    gradientBottom,
    glow
  };
}
