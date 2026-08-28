import React, { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
} from "react-native";
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

const COMPACT_HEIGHT = 700;

interface CountUpProps {
  /** The value to arrive at. */
  value: number;
  /**
   * Size of one rendered step. Fine enough that the count looks continuous,
   * coarse enough that it's tens of renders rather than hundreds.
   */
  quantum: number;
  format: (value: number) => string;
  /** The settled value, spoken as a sentence. */
  accessibilityLabel?: string;
  durationMs: number;
  delayMs?: number;
  /** Fired once, when the number has settled on its final value. */
  onSettled?: () => void;
  /** Renders the final value immediately, with no count. */
  immediate?: boolean;
  style?: StyleProp<TextStyle>;
}

/** The one number a screen is built around, counting up to itself. */
export default function CountUp({
  value,
  quantum,
  format,
  accessibilityLabel,
  durationMs,
  delayMs = 0,
  onSettled,
  immediate = false,
  style,
}: CountUpProps) {
  const { height } = useWindowDimensions();
  const [displayValue, setDisplayValue] = useState(immediate ? value : 0);
  const progress = useSharedValue(immediate ? 1 : 0);

  const settle = useCallback(() => {
    setDisplayValue(value);
    onSettled?.();
  }, [onSettled, value]);

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
    () => Math.round((progress.value * value) / quantum) * quantum,
    (current, previous) => {
      if (previous === null || current === previous) return;
      scheduleOnRN(setDisplayValue, current);
    }
  );

  return (
    <Text
      style={[styles.value, height < COMPACT_HEIGHT && styles.valueCompact, style]}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={1}
      adjustsFontSizeToFit
    >
      {format(displayValue)}
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
