import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";

const APPEAR_DELAY_MS = 700;
const APPEAR_MS = 420;
const DRIFT_MS = 2200;
const DRIFT_PX = 3;

interface FirstSessionCoachMarkProps {
  label?: string;
  /** Dismisses the hint without starting a session. */
  onDismiss: () => void;
}

/**
 * A single line pointing at Start Focus Session, for the one session that
 * matters most — the first. Deliberately not an overlay and not a tour: it sits
 * in the layout above the button, drifts slightly so the eye finds it, and goes
 * away for good once tapped or once a session runs.
 */
export default function FirstSessionCoachMark({
  label = "Help Marshmallow grow for the first time.",
  onDismiss,
}: FirstSessionCoachMarkProps) {
  const appear = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    appear.value = withDelay(
      APPEAR_DELAY_MS,
      withTiming(1, { duration: APPEAR_MS, easing: Easing.out(Easing.cubic) })
    );
    drift.value = withDelay(
      APPEAR_DELAY_MS + APPEAR_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.quad) }),
          withTiming(0, { duration: DRIFT_MS, easing: Easing.inOut(Easing.quad) })
        ),
        -1
      )
    );
  }, [appear, drift]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: appear.value,
    transform: [
      { translateY: (1 - appear.value) * 6 + drift.value * DRIFT_PX },
    ],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
      >
        <Text style={styles.text}>{label}</Text>
      </Pressable>
      <View style={styles.caret} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: Theme.radius.lg,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    fontFamily: Theme.fonts.medium,
    fontSize: 14,
    color: Theme.colors.text,
    textAlign: "center",
  },
  /** Points at the button below; drawn as a rotated square so it inherits the border. */
  caret: {
    width: 10,
    height: 10,
    marginTop: -5,
    transform: [{ rotate: "45deg" }],
    backgroundColor: Theme.colors.card,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
});
