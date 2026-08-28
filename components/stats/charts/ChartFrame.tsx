import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import type { ChartReference, SeriesPoint } from "@/lib/stats/types";
import type { ChartScale } from "./chartScale";

export const PLOT_HEIGHT = 148;
const LABEL_ROW_HEIGHT = 20;

interface ChartFrameProps {
  points: SeriesPoint[];
  references: ChartReference[];
  scale: ChartScale;
  /** Called with the measured plot width so a line chart can place its points. */
  onPlotWidth?: (width: number) => void;
  children: React.ReactNode;
}

/**
 * Shared chart chrome: the plot box, the reference lines drawn across it, and
 * the x-axis labels. Charts supply only their own marks, which keeps a bar and
 * a line chart aligned to the same baseline and the same axis rhythm.
 */
export default function ChartFrame({
  points,
  references,
  scale,
  onPlotWidth,
  children,
}: ChartFrameProps) {
  return (
    <View>
      <View
        style={styles.plot}
        onLayout={(event) => onPlotWidth?.(event.nativeEvent.layout.width)}
      >
        {references.map((reference) => (
          <ReferenceLine key={reference.style} reference={reference} scale={scale} />
        ))}
        <View style={styles.marks}>{children}</View>
      </View>

      <View style={styles.labelRow}>
        {points.map((point) => (
          <View key={point.at} style={styles.labelSlot}>
            <Text style={styles.label} numberOfLines={1}>
              {point.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ReferenceLine({
  reference,
  scale,
}: {
  reference: ChartReference;
  scale: ChartScale;
}) {
  const bottom = scale.ratio(reference.value) * PLOT_HEIGHT;
  const isGoal = reference.style === "goal";

  return (
    <View style={[styles.reference, { bottom }]} pointerEvents="none">
      <View style={[styles.referenceLine, isGoal ? styles.goalLine : styles.baselineLine]} />
      <Text style={[styles.referenceLabel, isGoal && styles.goalLabel]} numberOfLines={1}>
        {reference.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    height: PLOT_HEIGHT,
    justifyContent: "flex-end",
  },
  marks: {
    height: PLOT_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  reference: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  referenceLine: {
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  goalLine: {
    borderColor: Theme.colors.secondaryLight,
  },
  baselineLine: {
    borderColor: Theme.colors.cardBorder,
  },
  referenceLabel: {
    marginTop: 3,
    fontSize: 10,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    letterSpacing: 0.1,
  },
  goalLabel: {
    color: Theme.colors.secondaryLight,
  },
  labelRow: {
    height: LABEL_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    marginTop: Theme.spacing.sm,
  },
  labelSlot: {
    flex: 1,
    alignItems: "center",
  },
  label: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
});
