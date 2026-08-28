import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Theme from "@/constants/theme";
import { periodCaption } from "@/lib/stats/time";
import type { OverviewMetric, OverviewModel, StatsPeriodId } from "@/lib/stats/types";
import Comparison from "./Comparison";

const ENTER_DURATION_MS = 240;

interface OverviewPanelProps {
  overview: OverviewModel;
  period: StatsPeriodId;
}

/**
 * The first viewport. One number dominates and the rest sit under a hairline,
 * so the screen answers "am I improving?" before the user reads anything else.
 */
export default function OverviewPanel({ overview, period }: OverviewPanelProps) {
  const { hero, supporting } = overview;

  return (
    <Animated.View
      key={period}
      entering={FadeIn.duration(ENTER_DURATION_MS)}
      style={styles.container}
    >
      <Text style={styles.periodCaption}>{periodCaption(period)}</Text>

      <Text style={styles.heroLabel}>{hero.label}</Text>
      <Text style={styles.heroValue} testID="stats-overview-hero">
        {hero.value}
      </Text>
      {hero.unavailable ? (
        <Text style={styles.pending}>No focus sessions yet</Text>
      ) : (
        <Comparison text={hero.comparison} tone={hero.tone} />
      )}

      <View style={styles.divider} />

      <View style={styles.rows}>
        {supporting.map((metric) => (
          <SupportingRow key={metric.id} metric={metric} />
        ))}
      </View>
    </Animated.View>
  );
}

const SupportingRow = React.memo(function SupportingRow({
  metric,
}: {
  metric: OverviewMetric;
}) {
  // An unmeasurable metric says so in place of its value, rather than showing a
  // dash with an explanation floating under it.
  if (metric.unavailable) {
    return (
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{metric.label}</Text>
        <Text style={styles.rowPlaceholder}>
          {metric.unavailable === "no-source" ? "Not tracked yet" : "Not enough data yet"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{metric.label}</Text>

      <View style={styles.rowValues}>
        <Text style={styles.rowValue}>{metric.value}</Text>
        {metric.caption ? (
          <Text style={styles.rowNote}>{metric.caption}</Text>
        ) : (
          <Comparison text={metric.comparison} tone={metric.tone} size="sm" />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginTop: Theme.spacing.xxl,
  },
  periodCaption: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    letterSpacing: 0.2,
    marginBottom: Theme.spacing.xl,
  },
  heroLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  heroValue: {
    fontSize: 46,
    lineHeight: 54,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    letterSpacing: -1.4,
    marginTop: 2,
    marginBottom: Theme.spacing.xxs,
  },
  pending: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.divider,
    marginTop: Theme.spacing.xl,
  },
  rows: {
    marginTop: Theme.spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    gap: Theme.spacing.lg,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text,
    opacity: 0.8,
  },
  rowValues: {
    alignItems: "flex-end",
    gap: 1,
  },
  rowValue: {
    fontSize: 19,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.4,
  },
  rowPlaceholder: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  rowNote: {
    fontSize: 12.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
});
