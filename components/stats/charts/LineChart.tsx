import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import type { ChartReference, SeriesPoint } from "@/lib/stats/types";
import ChartFrame, { PLOT_HEIGHT } from "./ChartFrame";
import { buildScale, type ChartScale } from "./chartScale";

const DRAW_DURATION_MS = 380;
const STROKE_WIDTH = 2.5;
const DOT_SIZE = 9;

interface LineChartProps {
  points: SeriesPoint[];
  references?: ChartReference[];
  /** Changes to this value replay the draw animation — pass the period id. */
  animationKey?: string;
}

interface PlotPoint {
  x: number;
  y: number;
  index: number;
}

/**
 * A line chart drawn from rotated views, because the app carries no SVG
 * renderer. Segment counts stay in the tens, so this is cheaper than adding
 * one and looks identical at these widths.
 */
export default function LineChart({ points, references = [], animationKey }: LineChartProps) {
  const [plotWidth, setPlotWidth] = useState(0);
  const scale = buildScale(points, references);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: DRAW_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animationKey, plotWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 10 }],
  }));

  const plotted = toPlotPoints(points, scale, plotWidth);
  const lastPoint = plotted.length > 0 ? plotted[plotted.length - 1] : null;

  return (
    <ChartFrame
      points={points}
      references={references}
      scale={scale}
      onPlotWidth={setPlotWidth}
    >
      <Animated.View style={[styles.canvas, animatedStyle]}>
        {plotWidth > 0 &&
          plotted.map((point, i) => {
            const next = plotted[i + 1];
            // A gap in the data breaks the line rather than bridging it.
            if (!next || next.index !== point.index + 1) return null;
            return <Segment key={point.index} from={point} to={next} />;
          })}

        {lastPoint && (
          <View
            style={[
              styles.dot,
              { left: lastPoint.x - DOT_SIZE / 2, top: lastPoint.y - DOT_SIZE / 2 },
            ]}
          />
        )}
      </Animated.View>
    </ChartFrame>
  );
}

function toPlotPoints(
  points: SeriesPoint[],
  scale: ChartScale,
  plotWidth: number
): PlotPoint[] {
  if (plotWidth <= 0 || points.length === 0) return [];
  const step = plotWidth / points.length;

  return points.flatMap((point, index) =>
    point.value === null
      ? []
      : [
          {
            index,
            x: step * (index + 0.5),
            y: PLOT_HEIGHT - scale.ratio(point.value) * PLOT_HEIGHT,
          },
        ]
  );
}

function Segment({ from, to }: { from: PlotPoint; to: PlotPoint }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = `${Math.atan2(dy, dx)}rad`;

  return (
    <View
      style={[
        styles.segment,
        {
          left: from.x,
          top: from.y - STROKE_WIDTH / 2,
          width: length,
          transform: [{ rotate: angle }],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    height: PLOT_HEIGHT,
  },
  segment: {
    position: "absolute",
    height: STROKE_WIDTH,
    borderRadius: STROKE_WIDTH / 2,
    backgroundColor: Theme.colors.secondary,
    transformOrigin: "left center",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: Theme.colors.secondary,
    borderWidth: 2,
    borderColor: Theme.colors.background,
  },
});
