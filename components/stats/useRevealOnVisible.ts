import { useCallback } from "react";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

const REVEAL_DURATION_MS = 420;
const RISE_DISTANCE = 14;
/** How much of the block must be on screen before it counts as seen. */
const VISIBLE_MARGIN = 60;

type RevealStyle = Pick<ViewStyle, "opacity" | "transform">;

export interface RevealProps {
  onLayout: (event: LayoutChangeEvent) => void;
  style: RevealStyle;
}

/**
 * Fades a block in the first time it scrolls into view, then leaves it alone.
 * Re-running on every pass would turn the screen into constant motion, which
 * is the opposite of what Stats is meant to feel like.
 */
export function useRevealOnVisible(
  scrollY: SharedValue<number>,
  viewportHeight: number,
  /** Runs on the JS thread the one time the block becomes visible. */
  onReveal?: () => void
): RevealProps {
  const progress = useSharedValue(0);
  const top = useSharedValue(Number.POSITIVE_INFINITY);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      top.value = event.nativeEvent.layout.y;
    },
    [top]
  );

  useAnimatedReaction(
    () => scrollY.value + viewportHeight - VISIBLE_MARGIN > top.value,
    (isVisible, wasVisible) => {
      if (!isVisible || wasVisible || progress.value !== 0) return;
      progress.value = withTiming(1, {
        duration: REVEAL_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      });
      if (onReveal) scheduleOnRN(onReveal);
    },
    [viewportHeight, onReveal]
  );

  const style = useAnimatedStyle<RevealStyle>(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * RISE_DISTANCE }],
  }));

  return { onLayout, style };
}
