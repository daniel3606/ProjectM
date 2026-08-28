import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import type { StatsPeriodId } from "@/lib/stats/types";
import PremiumPreview from "./PremiumPreview";

const TEASER: Record<string, string> = {
  month: "See a full month of trends, and how each week compared to the last.",
  year: "See a year of history, long-term patterns and how far you've come.",
};

const INCLUDED = [
  "30-day, 3-month, 6-month and 1-year history",
  "App-level trends and a time-of-day breakdown",
  "Your strongest focus windows",
  "Which schedules actually work for you",
] as const;

interface LockedPeriodProps {
  period: StatsPeriodId;
  onUnlock: () => void;
}

/**
 * What a free account sees after tapping Month or Year. The period stays
 * tappable and the value is spelled out before any paywall appears.
 */
export default function LockedPeriod({ period, onUnlock }: LockedPeriodProps) {
  return (
    <View style={styles.container}>
      <PremiumPreview
        title={period === "year" ? "A year of history" : "A month of history"}
        teaser={TEASER[period] ?? TEASER.month}
        ctaLabel="Unlock Insights"
        onPressCta={onUnlock}
        testID="stats-locked-period"
      />

      <View style={styles.included}>
        {INCLUDED.map((item) => (
          <View key={item} style={styles.includedRow}>
            <Ionicons name="checkmark" size={15} color={Theme.colors.secondary} />
            <Text style={styles.includedLabel}>{item}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>
        Today and Week stay free, always.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Theme.spacing.xxl,
  },
  included: {
    marginTop: Theme.spacing.xxl,
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xxs,
  },
  includedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Theme.spacing.md,
  },
  includedLabel: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text,
    opacity: 0.8,
  },
  footnote: {
    marginTop: Theme.spacing.xxl,
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
});
