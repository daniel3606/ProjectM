import React, { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import { Button } from "@/components/ui";

const FADE_IN_MS = 420;
const RISE_PX = 10;

interface OnboardingCTAProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /**
   * Set false while a story animation is still playing. The button fades in
   * when it flips true, so the wait reads as the sequence finishing rather
   * than as a disabled control.
   */
  revealed?: boolean;
  /** Quiet text action under the CTA (e.g. "Skip for now"). Never a second CTA. */
  secondaryLabel?: string;
  onSecondaryPress?: () => void;
}

export default function OnboardingCTA({
  label,
  onPress,
  disabled,
  loading,
  revealed = true,
  secondaryLabel,
  onSecondaryPress,
}: OnboardingCTAProps) {
  const initiallyRevealed = useRef(revealed).current;
  const reveal = useSharedValue(initiallyRevealed ? 1 : 0);

  useEffect(() => {
    if (!revealed) return;
    if (reveal.value === 1) return;
    reveal.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [reveal, revealed]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * RISE_PX }],
  }));

  return (
    <Animated.View style={revealStyle} pointerEvents={revealed ? "auto" : "none"}>
      <Button label={label} onPress={onPress} disabled={disabled} loading={loading} />

      {secondaryLabel && onSecondaryPress ? (
        <Pressable
          onPress={onSecondaryPress}
          hitSlop={8}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
        >
          <Text style={styles.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.secondarySpacer} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  secondary: {
    alignSelf: "center",
    paddingVertical: 12,
    marginTop: 4,
  },
  // Holds the CTA at the same height whether or not there's a secondary action,
  // so the primary button never shifts between screens.
  secondarySpacer: {
    height: 4,
  },
  secondaryText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    color: Theme.colors.gray,
  },
  pressed: {
    opacity: 0.6,
  },
});
