import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import { formatMinutes } from "@/lib/stats/format";
import type { FocusModel, PeriodRange } from "@/lib/stats/types";
import Comparison from "./Comparison";
import EmptyState from "./EmptyState";
import StatsSection, { Interpretation } from "./StatsSection";
import BarChart from "./charts/BarChart";

interface FocusSectionProps {
  model: FocusModel;
  range: PeriodRange;
  /** Column to accent, e.g. today inside the current week. */
  highlightIndex?: number;
}

/** Answers one question: am I focusing more? */
export default function FocusSection({ model, range, highlightIndex }: FocusSectionProps) {
  if (model.unavailable) {
    return (
      <StatsSection title="Focused Time">
        <EmptyState
          icon="hourglass-outline"
          title="No focus sessions yet"
          body="Start a block and the time you protect will show up here."
        />
      </StatsSection>
    );
  }

  return (
    <StatsSection title="Focused Time">
      <BarChart
        points={model.series}
        highlightIndex={highlightIndex}
        animationKey={range.id}
      />

      <View style={styles.totals}>
        <View>
          <Text style={styles.total}>{formatMinutes(model.totalMinutes)}</Text>
          <Text style={styles.totalLabel}>total</Text>
        </View>

        <View style={styles.right}>
          <Comparison text={comparisonText(model, range)} tone={model.delta?.tone ?? "neutral"} />
          {range.dayCount > 1 ? (
            <Text style={styles.average}>
              {formatMinutes(model.averageMinutesPerDay)} average per day
            </Text>
          ) : null}
        </View>
      </View>

      {model.interpretation ? (
        <Interpretation>{model.interpretation}</Interpretation>
      ) : null}
    </StatsSection>
  );
}

function comparisonText(model: FocusModel, range: PeriodRange): string | null {
  if (!model.delta || model.delta.percent === null) return null;
  const percent = Math.round(model.delta.percent * 100);
  if (percent === 0) return `Same as ${range.comparisonLabel}`;
  const sign = percent > 0 ? "+" : "−";
  return `${sign}${Math.abs(percent)}% from ${range.comparisonLabel}`;
}

const styles = StyleSheet.create({
  totals: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.lg,
  },
  total: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    letterSpacing: -0.8,
  },
  totalLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  right: {
    alignItems: "flex-end",
    gap: 2,
  },
  average: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
});
