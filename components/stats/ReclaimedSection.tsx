import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue } from "react-native-reanimated";
import Theme from "@/constants/theme";
import { formatGain, formatLongDuration, formatMinutes } from "@/lib/stats/format";
import { periodCaption } from "@/lib/stats/time";
import type { PeriodRange, ReclaimedModel } from "@/lib/stats/types";
import Comparison from "./Comparison";
import EmptyState from "./EmptyState";
import StatsSection from "./StatsSection";
import { useRevealOnVisible } from "./useRevealOnVisible";

interface ReclaimedSectionProps {
  model: ReclaimedModel;
  range: PeriodRange;
  scrollY: SharedValue<number>;
  viewportHeight: number;
}

/**
 * The payoff section. Framing is always additive — what the user got back,
 * never what they lost — and the lifetime figure is the one meant to land.
 */
export default function ReclaimedSection({
  model,
  range,
  scrollY,
  viewportHeight,
}: ReclaimedSectionProps) {
  const reveal = useRevealOnVisible(scrollY, viewportHeight);

  if (model.unavailable) {
    return (
      <StatsSection title="Time Reclaimed">
        <EmptyState
          icon="leaf-outline"
          title="Nothing to count yet"
          body="Finish a focus block and the time you take back starts adding up here."
        />
      </StatsSection>
    );
  }

  return (
    <StatsSection title="Time Reclaimed">
      <Animated.View style={[styles.card, reveal.style]} onLayout={reveal.onLayout}>
        <Text style={styles.periodValue} testID="stats-reclaimed-period">
          {formatMinutes(model.periodMinutes)}
        </Text>
        <Text style={styles.periodLabel}>{periodCaption(range.id)}</Text>
        <Comparison
          text={formatGain(model.delta, range.comparisonLabel)}
          tone={model.delta?.tone ?? "neutral"}
          style={styles.comparison}
        />

        <View style={styles.divider} />

        <View style={styles.lifetimeRow}>
          <View style={styles.lifetimeText}>
            <Text style={styles.lifetimeValue}>
              {formatLongDuration(model.lifetimeMinutes)}
            </Text>
            <Text style={styles.lifetimeLabel}>{lifetimeLabel(model)}</Text>
          </View>
        </View>

        {model.interpretation ? (
          <Text style={styles.interpretation}>{model.interpretation}</Text>
        ) : null}
      </Animated.View>
    </StatsSection>
  );
}

function lifetimeLabel(model: ReclaimedModel): string {
  return model.basis === "below-baseline"
    ? "Since joining Marshmallow"
    : "Kept distraction-free since joining";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xxl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.xl,
  },
  periodValue: {
    fontSize: 40,
    lineHeight: 46,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    letterSpacing: -1.2,
  },
  periodLabel: {
    marginTop: 2,
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  comparison: {
    marginTop: Theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.divider,
    marginVertical: Theme.spacing.xl,
  },
  lifetimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  lifetimeText: {
    flex: 1,
  },
  lifetimeValue: {
    fontSize: 24,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
    letterSpacing: -0.6,
  },
  lifetimeLabel: {
    marginTop: 1,
    fontSize: 13.5,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  interpretation: {
    marginTop: Theme.spacing.lg,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text,
    opacity: 0.75,
  },
});
