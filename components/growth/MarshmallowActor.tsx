import React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import MarshmallowCharacter, {
  MARSHMALLOW_BODY_HEIGHT,
  getMarshmallowIntrinsicScale,
} from "@/components/MarshmallowCharacter";
import type { EquippedItems } from "@/constants/items";
import {
  FOCUS_HEIGHT_PX,
  MARSHMALLOW_GROUND_Y,
  MARSHMALLOW_PINNED_SIZE_CM,
  visualScaleForSize,
  worldXToSize,
} from "@/lib/growthWorld";

const DRAWN_HEIGHT =
  MARSHMALLOW_BODY_HEIGHT * getMarshmallowIntrinsicScale(MARSHMALLOW_PINNED_SIZE_CM);

/** Scale that renders the character at exactly {@link FOCUS_HEIGHT_PX}. */
const BASE_SCALE = FOCUS_HEIGHT_PX / DRAWN_HEIGHT;

/**
 * The character's intrinsic scale is applied about its centre, leaving its
 * feet this far above the bottom of its layout box. Cancelled out below so the
 * feet meet the ground line at every scale.
 */
const FOOT_INSET = (MARSHMALLOW_BODY_HEIGHT - DRAWN_HEIGHT) / 2;

/** Squash and stretch of the growth celebration, as fractions of the body. */
const PULSE_SQUASH_X = 0.09;
const PULSE_STRETCH_Y = 0.11;
const PULSE_HOP_PX = 16;

interface MarshmallowActorProps {
  cameraX: SharedValue<number>;
  /** The marshmallow's own world position, from its real stored size. */
  marshmallowWorldX: SharedValue<number>;
  /** Growth celebration, -1 (squashed) through 0 (rest) to 1 (stretched). */
  growthPulse: SharedValue<number>;
  color: string;
  name: string;
  isBlocking?: boolean;
  items?: EquippedItems;
}

/**
 * The marshmallow as an inhabitant of the world rather than a fixed element of
 * the UI. It obeys exactly the same position and scale law as every comparison
 * object, which is what makes the two modes one code path: in normal mode the
 * camera sits on the marshmallow's world position, so its offset is zero and
 * it lands centred at base scale without anything special being done. When the
 * camera is dragged away it simply drifts and rescales like everything else,
 * so there is no transition to blend and nothing that can teleport.
 */
export default function MarshmallowActor({
  cameraX,
  marshmallowWorldX,
  growthPulse,
  color,
  name,
  isBlocking,
  items,
}: MarshmallowActorProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const offset = marshmallowWorldX.value - cameraX.value;
    const scale =
      BASE_SCALE *
      visualScaleForSize(
        worldXToSize(marshmallowWorldX.value),
        worldXToSize(cameraX.value),
      );

    const pulse = growthPulse.value;
    const hop = -PULSE_HOP_PX * Math.max(pulse, 0);

    // The translations precede the scales so they stay in unscaled pixels.
    return {
      transform: [
        { translateX: offset },
        { translateY: FOOT_INSET * scale + hop },
        { scaleX: scale * (1 - PULSE_SQUASH_X * pulse) },
        { scaleY: scale * (1 + PULSE_STRETCH_Y * pulse) },
      ],
    };
  });

  return (
    <Animated.View style={[styles.actor, animatedStyle]} pointerEvents="none">
      <MarshmallowCharacter
        color={color}
        name={name}
        sizeCm={MARSHMALLOW_PINNED_SIZE_CM}
        isBlocking={isBlocking}
        items={items}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actor: {
    position: "absolute",
    bottom: MARSHMALLOW_GROUND_Y,
    left: 0,
    right: 0,
    alignItems: "center",
    // Always in front of the comparison objects.
    zIndex: 1000,
    // Scale up from the feet, not the middle.
    transformOrigin: "50% 100%",
  },
});
