import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";

const PULSE_DURATION_MS = 900;
const PULSE_MIN_OPACITY = 0.45;

/**
 * Matches the real layout's shape so nothing jumps when data lands. One slow
 * shared pulse, rather than a shimmer per block.
 */
export default function StatsSkeleton() {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration: PULSE_DURATION_MS,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View style={pulseStyle} testID="stats-skeleton">
      <View style={[styles.block, styles.caption]} />
      <View style={[styles.block, styles.heroLabel]} />
      <View style={[styles.block, styles.hero]} />
      <View style={[styles.block, styles.comparison]} />

      <View style={styles.divider} />

      {[0, 1, 2].map((row) => (
        <View key={row} style={styles.row}>
          <View style={[styles.block, styles.rowLabel]} />
          <View style={[styles.block, styles.rowValue]} />
        </View>
      ))}

      <View style={[styles.block, styles.sectionTitle]} />
      <View style={[styles.block, styles.chart]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: Theme.colors.track,
    borderRadius: Theme.radius.sm,
  },
  caption: {
    width: 78,
    height: 13,
    marginTop: Theme.spacing.xxl,
    marginBottom: Theme.spacing.xl,
  },
  heroLabel: {
    width: 96,
    height: 14,
  },
  hero: {
    width: 186,
    height: 44,
    marginTop: Theme.spacing.sm,
  },
  comparison: {
    width: 132,
    height: 14,
    marginTop: Theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Theme.colors.divider,
    marginTop: Theme.spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  rowLabel: {
    width: 104,
    height: 15,
  },
  rowValue: {
    width: 72,
    height: 19,
  },
  sectionTitle: {
    width: 124,
    height: 18,
    marginTop: 36,
  },
  chart: {
    height: 168,
    marginTop: Theme.spacing.lg,
    borderRadius: Theme.radius.xl,
  },
});
