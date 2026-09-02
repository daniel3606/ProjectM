import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";

export interface Hsl {
  /** Degrees, 0–360. */
  h: number;
  /** Percent, 0–100. */
  s: number;
  /** Percent, 0–100. */
  l: number;
}

/**
 * Lightness is deliberately not allowed to reach either end: a marshmallow at
 * 0% is a silhouette and at 100% it disappears into the cream background, and
 * neither reads as a character the user picked.
 */
export const CUSTOM_LIGHTNESS_RANGE = { min: 25, max: 95 } as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function channelToHex(value: number): string {
  return clamp(Math.round(value * 255), 0, 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
}

/** HSL (h in degrees, s/l in percent) to a `#RRGGBB` string. */
export function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = light - c / 2;

  const [r, g, b] =
    hue < 60
      ? [c, x, 0]
      : hue < 120
        ? [x, c, 0]
        : hue < 180
          ? [0, c, x]
          : hue < 240
            ? [0, x, c]
            : hue < 300
              ? [x, 0, c]
              : [c, 0, x];

  return `#${channelToHex(r + m)}${channelToHex(g + m)}${channelToHex(b + m)}`;
}

/** `#RGB` or `#RRGGBB` to HSL. Falls back to mid grey on anything unparseable. */
export function hexToHsl(hex: string): Hsl {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { h: 0, s: 0, l: 50 };

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) return { h: 0, s: 0, l: l * 100 };

  const s = delta / (1 - Math.abs(2 * l - 1));

  let h: number;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  return { h: (((h * 60) % 360) + 360) % 360, s: s * 100, l: l * 100 };
}

/** True when `hex` is one of the built-in palette swatches, case-insensitively. */
export function isPresetColor(hex: string): boolean {
  const target = hex.toLowerCase();
  return MARSHMALLOW_COLORS.some((c) => c.hex.toLowerCase() === target);
}
