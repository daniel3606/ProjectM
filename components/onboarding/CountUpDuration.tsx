import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions } from "react-native";
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Theme from "@/constants/theme";
import { formatScreenTime } from "@/lib/onboardingTime";

/**
 * Minutes per rendered frame of the count. Fine enough that the number looks
 * continuous, coarse enough that a two-hour count is ~30 renders rather than
 * one per minute.
 */
const QUANTUM_MINUTES = 5;

const COMPACT_HEIGHT = 700;

interface CountUpDurationProps {
  /** The value to arrive at. */
  minutes: number;
  durationMs: number;
  delayMs?: number;
  /** Fired once, when the number has settled on its final value. */
  onSettled?: () => void;
  /** Renders the final value immediately, with no count. */
  immediate?: boolean;
}

/** The reclaimed total, counting up to itself. The one number that has to land. */
export default function CountUpDuration({
  minutes,
  durationMs,
  delayMs = 0,
  onSettled,
  immediate = false,
}: CountUpDurationProps) {
  const { height } = useWindowDimensions();
  const [displayMinutes, setDisplayMinutes] = useState(immediate ? minutes : 0);
  const progress = useSharedValue(immediate ? 1 : 0);

  const settle = useCallback(() => {
    setDisplayMinutes(minutes);
    onSettled?.();
  }, [minutes, onSettled]);

  useEffect(() => {
    if (immediate) {
      settle();
      return;
    }

    progress.value = withDelay(
      delayMs,
      withTiming(
        1,
        { duration: durationMs, easing: Easing.out(Easing.cubic) },
        (finished) => {
          "worklet";
          if (finished) scheduleOnRN(settle);
        }
      )
    );

    return () => cancelAnimation(progress);
    // Restarting the count because `settle` changed identity would replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delayMs, durationMs, immediate, progress]);

  useAnimatedReaction(
    () =>
      Math.round((progress.value * minutes) / QUANTUM_MINUTES) * QUANTUM_MINUTES,
    (current, previous) => {
      if (previous === null || current === previous) return;
      scheduleOnRN(setDisplayMinutes, current);
    }
  );

  return (
    <Text
      style={[styles.value, height < COMPACT_HEIGHT && styles.valueCompact]}
      accessibilityLabel={`${formatScreenTime(minutes)} every day`}
    >
      {formatScreenTime(displayMinutes)}
    </Text>
  );
}

const styles = StyleSheet.create({
  value: {
    fontFamily: Theme.fonts.bold,
    fontSize: 66,
    lineHeight: 74,
    letterSpacing: -2,
    color: Theme.colors.text,
    textAlign: "center",
  },
  valueCompact: {
    fontSize: 54,
    lineHeight: 60,
  },
});
