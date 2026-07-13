import React from "react";
import { StyleSheet, Text } from "react-native";
import Theme from "@/constants/theme";
import Screen from "./Screen";

interface PlaceholderScreenProps {
  title: string;
  subtitle?: string;
}

/** Centered "coming soon" placeholder shared by not-yet-built tabs. */
export default function PlaceholderScreen({ title, subtitle = "Coming soon" }: PlaceholderScreenProps) {
  return (
    <Screen style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
});
