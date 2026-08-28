import React, { useEffect } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const DEFAULT_MS = 400;
const DEFAULT_RISE = 8;

interface FadeInProps {
  /** Flip to true to play the reveal. Flipping back does not reverse it. */
  visible: boolean;
  durationMs?: number;
  /** Pixels the content rises through as it appears. Small on purpose. */
  rise?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** The flow's one reveal: a short fade with a few pixels of lift. */
export default function FadeIn({
  visible,
  durationMs = DEFAULT_MS,
  rise = DEFAULT_RISE,
  style,
  children,
}: FadeInProps) {
  const progress = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (!visible) return;
    progress.value = withTiming(1, {
      duration: durationMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [durationMs, progress, visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * rise }],
  }));

  return <Animated.View style={[animatedStyle, style]}>{children}</Animated.View>;
}
