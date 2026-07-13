import React from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import Theme from "@/constants/theme";

/** Left-aligned screen/section heading, e.g. "Customize", "Timed Block". */
export function ScreenTitle({ style, ...props }: TextProps) {
  return <Text style={[styles.screenTitle, style]} {...props} />;
}

/** Left-aligned supporting line under a ScreenTitle. */
export function ScreenSubtitle({ style, ...props }: TextProps) {
  return <Text style={[styles.screenSubtitle, style]} {...props} />;
}

/** Large centered heading used on onboarding / full-screen flows. */
export function HeroTitle({ style, ...props }: TextProps) {
  return <Text style={[styles.heroTitle, style]} {...props} />;
}

/** Centered supporting line under a HeroTitle. */
export function HeroSubtitle({ style, ...props }: TextProps) {
  return <Text style={[styles.heroSubtitle, style]} {...props} />;
}

/** Small uppercase gray label used to introduce a section within a card list or sheet. */
export function SectionLabel({ style, ...props }: TextProps) {
  return <Text style={[styles.sectionLabel, style]} {...props} />;
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  screenSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginTop: 4,
  },
  heroTitle: {
    textAlign: "center",
    fontFamily: Theme.fonts.bold,
    fontSize: 32,
    padding: 10,
  },
  heroSubtitle: {
    textAlign: "center",
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
    color: Theme.colors.textSecondary,
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
