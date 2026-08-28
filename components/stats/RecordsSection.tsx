import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { type SharedValue } from "react-native-reanimated";
import Theme from "@/constants/theme";
import type { PersonalBest, RecordsModel } from "@/lib/stats/types";
import EmptyState from "./EmptyState";
import StatsSection from "./StatsSection";
import { useRevealOnVisible } from "./useRevealOnVisible";

interface RecordsSectionProps {
  model: RecordsModel;
  scrollY: SharedValue<number>;
  viewportHeight: number;
  /** Fires once, when the grid first scrolls into view. */
  onReveal: () => void;
}

/**
 * Allowed to feel a little more game-like than the rest of Stats, but the only
 * celebration is a small "New" tag — no medals, gradients or confetti.
 */
export default function RecordsSection({
  model,
  scrollY,
  viewportHeight,
  onReveal,
}: RecordsSectionProps) {
  const reveal = useRevealOnVisible(scrollY, viewportHeight, onReveal);

  if (model.unavailable) {
    return (
      <StatsSection title="Personal Bests">
        <EmptyState
          icon="ribbon-outline"
          title="Your first records are close"
          body="Finish a few sessions and your best day, week and session will show up here."
        />
      </StatsSection>
    );
  }

  const [lead, ...rest] = model.bests;

  return (
    <StatsSection title="Personal Bests">
      <Animated.View style={[styles.grid, reveal.style]} onLayout={reveal.onLayout}>
        {lead ? <RecordTile best={lead} wide /> : null}
        {rest.map((best) => (
          <RecordTile key={best.id} best={best} />
        ))}
      </Animated.View>
    </StatsSection>
  );
}

const RecordTile = React.memo(function RecordTile({
  best,
  wide,
}: {
  best: PersonalBest;
  wide?: boolean;
}) {
  const isSet = best.unavailable === null && best.display !== null;

  return (
    <View
      style={[styles.tile, wide && styles.tileWide]}
      testID={`stats-record-${best.id}`}
    >
      <View style={styles.tileHeader}>
        <Text style={styles.tileLabel} numberOfLines={2}>
          {best.label}
        </Text>
        {isSet && best.isNew ? (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeLabel}>New</Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.tileValue, !isSet && styles.tileValueMuted]}>
        {isSet ? best.display : "—"}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Theme.spacing.md,
  },
  tile: {
    flexGrow: 1,
    flexBasis: "46%",
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  tileWide: {
    flexBasis: "100%",
  },
  tileHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Theme.spacing.sm,
  },
  tileLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  newBadge: {
    backgroundColor: Theme.colors.positiveSoft,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  newBadgeLabel: {
    fontSize: 10.5,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.positive,
    letterSpacing: 0.3,
  },
  tileValue: {
    fontSize: 21,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    letterSpacing: -0.6,
  },
  tileValueMuted: {
    color: Theme.colors.cardBorder,
  },
});
