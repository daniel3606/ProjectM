import React from "react";
import { StyleSheet, Text, useWindowDimensions, type TextProps } from "react-native";
import Theme from "@/constants/theme";

/**
 * Below this height the headline steps down a size so a three-line question
 * still clears the CTA on an iPhone SE without scrolling.
 */
const COMPACT_HEIGHT = 700;

/** The one large line per screen. Everything else on the screen is quieter than this. */
export function Headline({ style, ...props }: TextProps) {
  const { height } = useWindowDimensions();
  const compact = height < COMPACT_HEIGHT;

  return (
    <Text
      style={[styles.headline, compact && styles.headlineCompact, style]}
      {...props}
    />
  );
}

/** At most two short lines. If it needs a paragraph, the screen is doing too much. */
export function Supporting({ style, ...props }: TextProps) {
  return <Text style={[styles.supporting, style]} {...props} />;
}

/** A value the screen is really about — the number above a slider. */
export function MetricValue({ style, ...props }: TextProps) {
  const { height } = useWindowDimensions();
  const compact = height < COMPACT_HEIGHT;

  return (
    <Text style={[styles.metric, compact && styles.metricCompact, style]} {...props} />
  );
}

const styles = StyleSheet.create({
  headline: {
    fontFamily: Theme.fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.4,
    color: Theme.colors.text,
    textAlign: "center",
  },
  headlineCompact: {
    fontSize: 27,
    lineHeight: 32,
  },
  supporting: {
    fontFamily: Theme.fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: Theme.colors.textSecondary,
    textAlign: "center",
  },
  metric: {
    fontFamily: Theme.fonts.bold,
    fontSize: 54,
    lineHeight: 62,
    letterSpacing: -1.4,
    color: Theme.colors.text,
    textAlign: "center",
  },
  metricCompact: {
    fontSize: 44,
    lineHeight: 50,
  },
});
