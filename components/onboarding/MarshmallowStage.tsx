import React, { useEffect, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import MarshmallowCharacter, {
  getMarshmallowIntrinsicScale,
  MARSHMALLOW_BODY_HEIGHT,
} from "@/components/MarshmallowCharacter";
import type { EquippedItems } from "@/constants/items";

const ENTRANCE_MS = 460;
const ENTRANCE_RISE = 18;
const ENTRANCE_FROM_SCALE = 0.92;

const FLOAT_TRAVEL = -5;
const FLOAT_HALF_CYCLE_MS = 2100;

const GROWTH_MS = 560;
/** A single measured pulse as it lands — enough to read as a body, not a bounce. */
const GROWTH_SETTLE_MS = 220;

interface MarshmallowStageProps {
  color: string;
  name: string;
  items?: EquippedItems;
  /** Feeds the character's own size-driven proportions. Onboarding uses a hatchling. */
  sizeCm?: number;
  /** Layout scale. The stage reserves height for this, so nothing below it shifts. */
  scale?: number;
  /** Plays a settle-in on mount. Skip it when the character is already on screen. */
  entrance?: boolean;
  entranceDelayMs?: number;
  onEntranceSettled?: () => void;
  /** Slow vertical drift once settled. Off by default; it belongs on hero screens only. */
  float?: boolean;
  /** Multiplier animated to whenever it changes — this is how the character grows. */
  growth?: number;
  /**
   * Change this to replay a single small settle, without changing size. Used
   * when an appearance choice changes, so the character acknowledges the edit.
   */
  pulseToken?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Wraps the shared character with the onboarding's motion: an entrance, an
 * optional idle drift, and a growth step. Keeping all three here means every
 * screen animates the marshmallow the same way.
 */
export default function MarshmallowStage({
  color,
  name,
  items,
  sizeCm = 3,
  scale = 1,
  entrance = false,
  entranceDelayMs = 120,
  onEntranceSettled,
  float = false,
  growth = 1,
  pulseToken = 0,
  style,
}: MarshmallowStageProps) {
  const reveal = useSharedValue(entrance ? 0 : 1);
  const drift = useSharedValue(0);
  const growthScale = useSharedValue(growth);
  const pulse = useSharedValue(1);
  const firstPulseTokenRef = useRef(pulseToken);

  const drawnHeight = MARSHMALLOW_BODY_HEIGHT * getMarshmallowIntrinsicScale(sizeCm) * scale;

  useEffect(() => {
    if (!entrance) {
      onEntranceSettled?.();
      return;
    }

    const settled = onEntranceSettled;
    reveal.value = withDelay(
      entranceDelayMs,
      withTiming(1, { duration: ENTRANCE_MS, easing: Easing.out(Easing.cubic) }, (finished) => {
        "worklet";
        if (finished && settled) scheduleOnRN(settled);
      })
    );

    return () => cancelAnimation(reveal);
    // Re-running this on a changed callback identity would replay the entrance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrance, entranceDelayMs, reveal]);

  useEffect(() => {
    if (!float) return;

    drift.value = withDelay(
      entrance ? entranceDelayMs + ENTRANCE_MS : 0,
      withRepeat(
        withSequence(
          withTiming(1, {
            duration: FLOAT_HALF_CYCLE_MS,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: FLOAT_HALF_CYCLE_MS,
            easing: Easing.inOut(Easing.quad),
          })
        ),
        -1
      )
    );

    return () => {
      cancelAnimation(drift);
      drift.value = 0;
    };
  }, [drift, entrance, entranceDelayMs, float]);

  useEffect(() => {
    growthScale.value = withSequence(
      withTiming(growth * 1.02, {
        duration: GROWTH_MS,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(growth, { duration: GROWTH_SETTLE_MS, easing: Easing.out(Easing.quad) })
    );

    return () => cancelAnimation(growthScale);
  }, [growth, growthScale]);

  useEffect(() => {
    if (pulseToken === firstPulseTokenRef.current) return;

    pulse.value = withSequence(
      withTiming(1.04, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })
    );

    return () => cancelAnimation(pulse);
  }, [pulse, pulseToken]);

  const characterStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: (1 - reveal.value) * ENTRANCE_RISE + drift.value * FLOAT_TRAVEL },
      {
        scale:
          scale *
          growthScale.value *
          pulse.value *
          (ENTRANCE_FROM_SCALE + (1 - ENTRANCE_FROM_SCALE) * reveal.value),
      },
    ],
  }));

  return (
    <View style={[styles.stage, { height: drawnHeight }, style]}>
      <Animated.View style={characterStyle}>
        <MarshmallowCharacter color={color} name={name} sizeCm={sizeCm} items={items} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    justifyContent: "center",
  },
});
