import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import type { ChartReference, SeriesPoint } from "@/lib/stats/types";
import ChartFrame, { PLOT_HEIGHT } from "./ChartFrame";
import { buildScale } from "./chartScale";

const GROW_DURATION_MS = 320;
const STAGGER_MS = 14;
/** Bars keep a visible foot at zero so an empty day still reads as a column. */
const MIN_BAR_HEIGHT = 3;

interface BarChartProps {
  points: SeriesPoint[];
  references?: ChartReference[];
  /** Index to draw in the accent tone, e.g. today's column. */
  highlightIndex?: number;
  /** Changes to this value replay the grow animation — pass the period id. */
  animationKey?: string;
}

export default function BarChart({
  points,
  references = [],
  highlightIndex,
  animationKey,
}: BarChartProps) {
  const scale = buildScale(points, references);

  return (
    <ChartFrame points={points} references={references} scale={scale}>
      {points.map((point, index) => (
        <View key={point.at} style={styles.slot}>
          <Bar
            heightRatio={point.value === null ? 0 : scale.ratio(point.value)}
            index={index}
            highlighted={index === highlightIndex}
            hasValue={point.value !== null}
            animationKey={animationKey}
          />
        </View>
      ))}
    </ChartFrame>
  );
}

interface BarProps {
  heightRatio: number;
  index: number;
  highlighted: boolean;
  hasValue: boolean;
  animationKey?: string;
}

function Bar({ heightRatio, index, highlighted, hasValue, animationKey }: BarProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      index * STAGGER_MS,
      withTiming(1, { duration: GROW_DURATION_MS, easing: Easing.out(Easing.cubic) })
    );
  }, [progress, index, heightRatio, animationKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: Math.max(MIN_BAR_HEIGHT, heightRatio * PLOT_HEIGHT * progress.value),
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        highlighted ? styles.barHighlighted : styles.barDefault,
        !hasValue && styles.barEmpty,
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  slot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    height: PLOT_HEIGHT,
  },
  bar: {
    width: "58%",
    maxWidth: 22,
    borderRadius: Theme.radius.sm,
  },
  barDefault: {
    backgroundColor: Theme.colors.secondaryLight,
  },
  barHighlighted: {
    backgroundColor: Theme.colors.secondary,
  },
  barEmpty: {
    backgroundColor: Theme.colors.track,
  },
});
