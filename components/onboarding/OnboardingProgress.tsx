import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";

const FILL_MS = 380;

interface OnboardingProgressProps {
  /** 0–1. Animates whenever it changes, so advancing a step reads as motion. */
  value: number;
}

/**
 * A hairline bar rather than a "step 3 of 10" counter — it answers "am I nearly
 * done?" without inviting the user to count how much is left.
 */
export default function OnboardingProgress({ value }: OnboardingProgressProps) {
  const progress = useSharedValue(value);

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value)), {
      duration: FILL_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(139,99,92,0.14)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Theme.colors.secondary,
  },
});
