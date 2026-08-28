import React, { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";

/**
 * How long the user has to hold before the block starts. Long enough to read
 * as deliberate rather than a mis-tap, short enough not to feel stuck — iOS
 * treats 500ms as a long press, so this sits just above it.
 */
const HOLD_DURATION_MS = 900;

interface HoldToStartButtonProps {
  label: string;
  onComplete: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Press-and-hold confirmation for starting a block. A block is hard to undo
 * (Hard Mode can't be ended at all), so it shouldn't be one stray tap away —
 * the fill bar makes the commitment visible while it's still cancellable.
 */
export default function HoldToStartButton({
  label,
  onComplete,
  disabled,
  style,
  testID,
}: HoldToStartButtonProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  // Held in a ref so the finished-callback can't fire onComplete after the
  // press was released or the component unmounted mid-hold.
  const isHoldingRef = useRef(false);

  useEffect(
    () => () => {
      isHoldingRef.current = false;
      animationRef.current?.stop();
    },
    []
  );

  const reset = useCallback(() => {
    isHoldingRef.current = false;
    animationRef.current?.stop();
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [progress]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    isHoldingRef.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animationRef.current = animation;

    animation.start(({ finished }) => {
      if (!finished || !isHoldingRef.current) return;
      isHoldingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onComplete();
      progress.setValue(0);
    });
  }, [disabled, onComplete, progress]);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={reset}
      disabled={disabled}
      testID={testID}
      style={[styles.button, disabled && styles.disabled, style]}
    >
      {/* Anchored left and scaled on the X axis so the fill can ride the
          native driver instead of animating layout width every frame. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.fill, { transform: [{ scaleX: progress }] }]}
      />
      <View style={styles.content} pointerEvents="none">
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: Theme.radius.xxl,
    backgroundColor: Theme.colors.secondary,
    paddingVertical: 18,
    overflow: "hidden",
    ...Theme.shadows.button,
  },
  disabled: {
    opacity: 0.5,
  },
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Theme.colors.text,
    opacity: 0.28,
    transformOrigin: "left",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Theme.spacing.sm,
  },
  label: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});
