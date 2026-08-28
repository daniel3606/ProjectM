import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";
import { PERIOD_LABELS, PERIOD_ORDER } from "@/lib/stats/time";
import type { StatsPeriodId } from "@/lib/stats/types";

const SLIDE_DURATION_MS = 260;
const TRACK_PADDING = 3;

interface PeriodSelectorProps {
  value: StatsPeriodId;
  onChange: (period: StatsPeriodId) => void;
  /** Periods the account can't open yet still get a preview, never a disabled tab. */
  lockedPeriods?: StatsPeriodId[];
}

export default function PeriodSelector({
  value,
  onChange,
  lockedPeriods = [],
}: PeriodSelectorProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth =
    trackWidth > 0 ? (trackWidth - TRACK_PADDING * 2) / PERIOD_ORDER.length : 0;
  const activeIndex = PERIOD_ORDER.indexOf(value);

  const offset = useDerivedValue(
    () =>
      withTiming(activeIndex * segmentWidth, {
        duration: SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      }),
    [activeIndex, segmentWidth]
  );

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: offset.value }],
  }));

  const handlePress = useCallback(
    (period: StatsPeriodId) => {
      if (period === value) return;
      Haptics.selectionAsync();
      onChange(period);
    },
    [onChange, value]
  );

  return (
    <View
      style={styles.track}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      {segmentWidth > 0 ? (
        <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
      ) : null}

      {PERIOD_ORDER.map((period) => (
        <PeriodTab
          key={period}
          period={period}
          isActive={period === value}
          isLocked={lockedPeriods.includes(period)}
          onPress={handlePress}
        />
      ))}
    </View>
  );
}

interface PeriodTabProps {
  period: StatsPeriodId;
  isActive: boolean;
  isLocked: boolean;
  onPress: (period: StatsPeriodId) => void;
}

const PeriodTab = React.memo(function PeriodTab({
  period,
  isActive,
  isLocked,
  onPress,
}: PeriodTabProps) {
  const handlePress = useCallback(() => onPress(period), [onPress, period]);

  return (
    <Pressable
      onPress={handlePress}
      style={styles.segment}
      testID={`stats-period-${period}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[
          styles.label,
          isActive && styles.labelActive,
          isLocked && !isActive && styles.labelLocked,
        ]}
      >
        {PERIOD_LABELS[period]}
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  track: {
    flexDirection: "row",
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: TRACK_PADDING,
  },
  indicator: {
    position: "absolute",
    top: TRACK_PADDING,
    left: TRACK_PADDING,
    bottom: TRACK_PADDING,
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radius.sm,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  labelActive: {
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  labelLocked: {
    color: Theme.colors.cardBorder,
  },
});
