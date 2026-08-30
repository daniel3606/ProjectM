import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import {
  MARSHMALLOW_BODY_HEIGHT,
  MARSHMALLOW_BODY_RADIUS,
  MARSHMALLOW_BODY_WIDTH,
  getMarshmallowIntrinsicScale,
} from "@/components/MarshmallowCharacter";
import {
  FOCUS_HEIGHT_PX,
  MARSHMALLOW_FOREGROUND_DROP_PX,
  MARSHMALLOW_GROUND_Y,
  MARSHMALLOW_PINNED_SIZE_CM,
  MIN_PINNED_SCALE,
  pinProgress,
  pinnedOffsetPx,
  visualScaleForSize,
  worldXToSize,
} from "@/lib/growthWorld";

const INTRINSIC_SCALE = getMarshmallowIntrinsicScale(MARSHMALLOW_PINNED_SIZE_CM);

// The character applies its intrinsic scale as a transform, so its drawn body
// is smaller than its layout box. The silhouette is drawn at the *drawn* size
// directly, which puts its feet on the bottom of its own box and saves it the
// foot-inset correction MarshmallowActor needs.
const BODY_WIDTH = MARSHMALLOW_BODY_WIDTH * INTRINSIC_SCALE;
const BODY_HEIGHT = MARSHMALLOW_BODY_HEIGHT * INTRINSIC_SCALE;
const BODY_RADIUS = MARSHMALLOW_BODY_RADIUS * INTRINSIC_SCALE;

/** Scale that renders the silhouette at exactly {@link FOCUS_HEIGHT_PX}. */
const BASE_SCALE = FOCUS_HEIGHT_PX / BODY_HEIGHT;

/** Faint enough to read as a target rather than as a second marshmallow. */
const GHOST_OPACITY = 0.45;

interface GhostMarshmallowProps {
  cameraX: SharedValue<number>;
  /** World position of the size the running block will finish at. */
  worldX: SharedValue<number>;
  /** 0 hidden through 1 shown, so the silhouette can fade in and out. */
  presence: SharedValue<number>;
  color: string;
}

/**
 * An outline standing where the marshmallow will be once the running block
 * pays out. It follows the same law as the marshmallow, pin included, so
 * scrubbing the scene moves the two together and the gap between them stays
 * honest at any camera position.
 */
export default function GhostMarshmallow({
  cameraX,
  worldX,
  presence,
  color,
}: GhostMarshmallowProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const drift = worldX.value - cameraX.value;
    const offset = pinnedOffsetPx(drift);
    const pin = pinProgress(drift);
    const scale =
      BASE_SCALE *
      visualScaleForSize(
        worldXToSize(worldX.value),
        worldXToSize(cameraX.value),
        MIN_PINNED_SCALE,
      );

    return {
      opacity: presence.value * GHOST_OPACITY,
      // The translations precede the scales so they stay in unscaled pixels.
      transform: [
        { translateX: offset },
        { translateY: -MARSHMALLOW_FOREGROUND_DROP_PX * pin },
        { scaleX: scale },
        { scaleY: scale },
      ],
    };
  });

  return (
    <Animated.View style={[styles.ghost, animatedStyle]} pointerEvents="none">
      <View style={[styles.body, { borderColor: color }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: {
    position: "absolute",
    bottom: MARSHMALLOW_GROUND_Y,
    left: 0,
    right: 0,
    alignItems: "center",
    // Above the comparison objects, behind the marshmallow itself.
    zIndex: 950,
    // Scale up from the feet, not the middle.
    transformOrigin: "50% 100%",
  },
  body: {
    width: BODY_WIDTH,
    height: BODY_HEIGHT,
    borderRadius: BODY_RADIUS,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
