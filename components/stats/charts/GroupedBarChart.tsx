import React, { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import type { SeriesPoint, TrendSeries } from "@/lib/stats/types";
import ChartFrame, { PLOT_HEIGHT } from "./ChartFrame";
import { buildScale } from "./chartScale";

const GROW_DURATION_MS = 320;
const STAGGER_MS = 12;
/** A bar keeps a visible foot at zero, so an empty day still reads as a column. */
const MIN_BAR_HEIGHT = 3;
/** A lone series gets the full column; paired bars each take half of it. */
const BAR_MAX_WIDTH = 22;

const SERIES_COLORS: Record<TrendSeries["id"], string> = {
  screenTime: Theme.colors.secondaryLight,
  blocked: Theme.colors.positive,
};

interface GroupedBarChartProps {
  /** Drawn in order; each contributes one bar per bucket. */
  series: TrendSeries[];
  /** Index to draw at full strength, e.g. today's column. */
  highlightIndex?: number;
  /** Changes to this value replay the grow animation — pass the period id. */
  animationKey?: string;
}

/**
 * Screen time and blocked time as paired columns on one axis. Both are
 * minutes, so they share a scale and a day's two bars can be read against
 * each other rather than only against their own series.
 */
export default function GroupedBarChart({
  series,
  highlightIndex,
  animationKey,
}: GroupedBarChartProps) {
  const drawable = useMemo(
    () => series.filter((s) => s.unavailable === null && s.points.length > 0),
    [series]
  );

  // Every series is scaled together, which is the whole point of pairing them.
  const scale = useMemo(
    () => buildScale(drawable.flatMap((s) => s.points)),
    [drawable]
  );

  // The axis comes from the longest series so a missing one never shortens it.
  const axis = useMemo(
    () =>
      drawable.reduce<SeriesPoint[]>(
        (longest, s) => (s.points.length > longest.length ? s.points : longest),
        []
      ),
    [drawable]
  );

  const barStyle = useMemo(
    () => ({ maxWidth: BAR_MAX_WIDTH / Math.max(1, drawable.length) }),
    [drawable.length]
  );

  return (
    <View>
      <View style={styles.legend}>
        {drawable.map((s) => (
          <View key={s.id} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: SERIES_COLORS[s.id] }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ChartFrame points={axis} references={[]} scale={scale}>
        {axis.map((point, index) => (
          <View key={point.at} style={styles.slot}>
            {drawable.map((s) => {
              const value = s.points[index]?.value ?? null;
              return (
                <Bar
                  key={s.id}
                  color={SERIES_COLORS[s.id]}
                  heightRatio={value === null ? 0 : scale.ratio(value)}
                  hasValue={value !== null}
                  dimmed={highlightIndex !== undefined && index !== highlightIndex}
                  index={index}
                  widthStyle={barStyle}
                  animationKey={animationKey}
                />
              );
            })}
          </View>
        ))}
      </ChartFrame>
    </View>
  );
}

interface BarProps {
  color: string;
  heightRatio: number;
  hasValue: boolean;
  dimmed: boolean;
  index: number;
  /** Column share this bar takes, which depends on how many series are drawn. */
  widthStyle: { maxWidth: number };
  animationKey?: string;
}

const Bar = React.memo(function Bar({
  color,
  heightRatio,
  hasValue,
  dimmed,
  index,
  widthStyle,
  animationKey,
}: BarProps) {
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
        widthStyle,
        { backgroundColor: hasValue ? color : Theme.colors.track },
        dimmed && styles.barDimmed,
        animatedStyle,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 12.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  slot: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
    height: PLOT_HEIGHT,
  },
  bar: {
    flex: 1,
    borderRadius: Theme.radius.sm,
  },
  barDimmed: {
    opacity: 0.55,
  },
});
