import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import * as ScreenTime from "@/modules/screen-time";
import { getUsageReportView } from "@/modules/screen-time";
import type { PeriodRange } from "@/lib/stats/types";

/**
 * Scenes registered by the MarshmallowUsageReport extension. Adding one here
 * means adding the matching scene to that target — the context name is the
 * only thing the app can send it.
 */
export const USAGE_REPORT = {
  /** Screen Time and Most Used Apps together — one report, not two. */
  summaryStats: "marshmallow.summaryStats",
  appUsageList: "marshmallow.appUsageList",
} as const;

export type UsageReportContext =
  (typeof USAGE_REPORT)[keyof typeof USAGE_REPORT];

/** Row height and count the extension draws, which JS has to reserve space for. */
export const REPORT_ROW_HEIGHT = 62;
export const REPORT_ROWS = 8;

/**
 * Whether the Screen Time report can actually draw anything.
 *
 * The view existing isn't enough: without authorization iOS renders the
 * report empty, which would replace the card's "not connected yet" copy with
 * a blank rectangle and no way to tell why.
 *
 * Read once per render pass by the screen rather than by each card — this
 * crosses to the native module, and the two cards ask the same question.
 */
export function canShowUsageReport(): boolean {
  if (getUsageReportView() === null) return false;
  return ScreenTime.getAuthorizationStatus() === "approved";
}

interface UsageReportProps {
  context: UsageReportContext;
  /** The window being shown; its comparison window sets the filter's left edge. */
  range: PeriodRange;
  /**
   * Space to reserve. A report extension can't report its own size, so the
   * host fixes it — a window with fewer apps than the reserved rows leaves
   * blank space at the bottom rather than shrinking.
   */
  height: number;
  /** Flex weight when the report stands in for more than one column. */
  flex?: number;
}

/**
 * Embeds one scene of the Screen Time report.
 *
 * The figures are drawn by the extension and never enter this process, so
 * there is nothing to read back here — see targets/MarshmallowUsageReport.
 * Returns null wherever the report can't run (Android, Expo Go, a build
 * without the extension), which is what makes the surrounding cards fall back
 * to their own empty states.
 */
export default function UsageReport({
  context,
  range,
  height,
  flex,
}: UsageReportProps) {
  const Report = getUsageReportView();

  // `alignSelf` is load-bearing: the hosted view has no size of its own, so
  // inside a centring column it collapses to zero width and draws nothing.
  const box = useMemo(
    () => ({ height, alignSelf: "stretch" as const, flex }),
    [height, flex]
  );

  if (!Report) return null;

  return (
    <View style={box} pointerEvents="none">
      <Report
        reportContext={context}
        startMs={range.previousStart}
        endMs={range.end}
        boundaryMs={range.start}
        segment={segmentFor(range)}
        style={styles.report}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  report: { flex: 1 },
});

/** A year asked for daily segments is thousands of iterations it never uses. */
function segmentFor(range: PeriodRange): "hourly" | "daily" | "weekly" {
  if (range.bucketUnit === "month") return "weekly";
  return "daily";
}
