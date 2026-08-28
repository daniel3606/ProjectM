import React from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import Theme from "@/constants/theme";
import type { MetricDelta } from "@/lib/stats/types";

interface ComparisonProps {
  /** Pre-formatted comparison, e.g. "↑ 18% vs last week". */
  text: string | null;
  tone: MetricDelta["tone"];
  size?: "sm" | "md";
  style?: StyleProp<TextStyle>;
}

const TONE_STYLES = {
  positive: { color: Theme.colors.positive },
  negative: { color: Theme.colors.attention },
  neutral: { color: Theme.colors.textSecondary },
} as const;

/** The change line that sits under a metric. Never shown without a value above it. */
export default function Comparison({ text, tone, size = "md", style }: ComparisonProps) {
  if (!text) return null;
  return (
    <Text style={[styles.base, size === "sm" && styles.small, TONE_STYLES[tone], style]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    letterSpacing: -0.1,
  },
  small: {
    fontSize: 12.5,
  },
});
