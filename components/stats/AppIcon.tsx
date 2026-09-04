import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import { getTokenIconView } from "@/modules/screen-time";
import type { ScreenTimeItemType } from "@/lib/stats/types";

/** Icon corner radius as a share of its size, matching the iOS app-icon curve. */
const CORNER_RATIO = 0.225;
/** Monogram type, as a share of the tile. Keeps one and two letters balanced. */
const MONOGRAM_RATIO = 0.42;

interface AppIconProps {
  /** Opaque FamilyControls token. Without one the tile falls back to a monogram. */
  token: string | null;
  itemType: ScreenTimeItemType;
  /** Used for the monogram and for the accessibility label. */
  label: string;
  size: number;
}

/**
 * One app's icon. iOS never hands an app icon over as data, so the real thing
 * only appears where a Screen Time token exists and the native view is in the
 * build; everywhere else — Android, Expo Go, a source with no tokens — this
 * draws a monogram tile of the same size so rows never reflow.
 */
export default function AppIcon({ token, itemType, label, size }: AppIconProps) {
  const TokenIcon = getTokenIconView();
  const boxStyle = useMemo(
    () => ({ width: size, height: size, borderRadius: size * CORNER_RATIO }),
    [size]
  );
  const item = useMemo(
    () => ({ id: label, type: itemType, token: token ?? "" }),
    [label, itemType, token]
  );

  if (TokenIcon && token) {
    return (
      <TokenIcon
        item={item}
        size={size}
        cornerRadius={size * CORNER_RATIO}
        style={boxStyle}
      />
    );
  }

  return (
    <View
      style={[styles.fallback, boxStyle]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Text style={[styles.monogram, { fontSize: size * MONOGRAM_RATIO }]}>
        {monogram(label)}
      </Text>
    </View>
  );
}

/** First letter of each of the first two words, e.g. "Google Maps" → "GM". */
export function monogram(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.track,
  },
  monogram: {
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
    letterSpacing: -0.3,
  },
});
