import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import { formatMinutes, formatPercent } from "@/lib/stats/format";
import type { SessionsModel } from "@/lib/stats/types";
import EmptyState from "./EmptyState";
import StatsSection from "./StatsSection";

interface SessionsSectionProps {
  model: SessionsModel;
}

/**
 * Completion rate and total focused time lead; the counts sit under them as
 * supporting detail rather than five equal tiles.
 */
export default function SessionsSection({ model }: SessionsSectionProps) {
  if (model.unavailable) {
    return (
      <StatsSection title="Focus Sessions">
        <EmptyState
          icon="timer-outline"
          title="No sessions in this period"
          body="Your completion rate builds up as you run more blocks."
        />
      </StatsSection>
    );
  }

  return (
    <StatsSection title="Focus Sessions">
      <View style={styles.card}>
        <View style={styles.headline}>
          <View style={styles.headlineItem}>
            <Text style={styles.headlineValue}>{formatPercent(model.completionRate)}</Text>
            <Text style={styles.headlineLabel}>Completion rate</Text>
          </View>

          <View style={styles.headlineDivider} />

          <View style={styles.headlineItem}>
            <Text style={styles.headlineValue}>
              {formatMinutes(model.totalFocusedMinutes)}
            </Text>
            <Text style={styles.headlineLabel}>Focused</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.details}>
          <Detail label="Started" value={String(model.started)} />
          <Detail label="Completed" value={String(model.completed)} />
          <Detail label="Average" value={formatMinutes(model.averageSessionMinutes)} />
          <Detail label="Longest" value={formatMinutes(model.longestSessionMinutes)} />
        </View>
      </View>
    </StatsSection>
  );
}

const Detail = React.memo(function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: Theme.spacing.xl,
  },
  headline: {
    flexDirection: "row",
    alignItems: "center",
  },
  headlineItem: {
    flex: 1,
  },
  headlineDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: Theme.colors.divider,
    marginHorizontal: Theme.spacing.lg,
  },
  headlineValue: {
    fontSize: 30,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    letterSpacing: -0.9,
  },
  headlineLabel: {
    marginTop: 1,
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.divider,
    marginVertical: Theme.spacing.lg,
  },
  details: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detail: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 12.5,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  detailValue: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.3,
  },
});
