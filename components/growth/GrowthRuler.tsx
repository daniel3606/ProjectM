import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import { RULER_HEIGHT, RULER_TICKS } from "@/lib/growthWorld";
import EdgeFade from "@/components/growth/EdgeFade";

const BASELINE_Y = 20;
const MAJOR_TICK_HEIGHT = 13;
const MINOR_TICK_HEIGHT = 7;
const TICK_SLOT_WIDTH = 44;

interface GrowthRulerProps {
  cameraX: SharedValue<number>;
  marshmallowWorldX: SharedValue<number>;
  /** 0 in normal mode, 1 while the camera is under the user's control. */
  previewProgress: SharedValue<number>;
  /** Marshmallow colour, used for the "you are here" marker. */
  color: string;
  /**
   * When the camera leads toward a block's goal, the centre caret no longer
   * lines up with the size readout, so the strip hides itself and only returns
   * for the duration of an actual scrub.
   */
  dimWhenResting?: boolean;
}

/**
 * A logarithmic centimetre ruler living in the same world coordinates as
 * everything else, so it pans in lockstep with the scene for free.
 *
 * The whole tick strip is one animated view driven by a single worklet — the
 * ticks themselves are static children at fixed world positions, so the cost
 * of the ruler does not grow with the number of ticks. Two indicators sit on
 * top of it: a fixed caret at the centre, which always reads the size the
 * camera is pointing at, and a marker at the marshmallow's true position that
 * surfaces while previewing to show where "home" is.
 */
export default function GrowthRuler({
  cameraX,
  marshmallowWorldX,
  previewProgress,
  color,
  dimWhenResting = false,
}: GrowthRulerProps) {
  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -cameraX.value }],
  }));

  const rulerStyle = useAnimatedStyle(() => ({
    opacity: dimWhenResting ? previewProgress.value : 1,
  }));

  const homeMarkerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: marshmallowWorldX.value - cameraX.value }],
    opacity: previewProgress.value,
  }));

  return (
    <Animated.View style={[styles.ruler, rulerStyle]}>
      <View style={styles.baseline} />

      <Animated.View style={[styles.strip, stripStyle]}>
        <View style={styles.origin}>
          {RULER_TICKS.map((tick) => (
            <View
              key={String(tick.cm)}
              style={[styles.tickSlot, { left: tick.worldX - TICK_SLOT_WIDTH / 2 }]}
            >
              <View style={tick.isMajor ? styles.tickMajor : styles.tickMinor} />
              {tick.label ? (
                <Text style={styles.tickLabel}>{tick.label}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </Animated.View>

      <EdgeFade width={36} />

      <Animated.View style={[styles.homeMarkerLayer, homeMarkerStyle]}>
        <View style={[styles.homeMarker, { backgroundColor: color }]} />
      </Animated.View>

      <View style={styles.caretLayer} pointerEvents="none">
        <View style={styles.caretArrow} />
        <View style={styles.caretStem} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ruler: {
    height: RULER_HEIGHT,
    overflow: "hidden",
  },
  baseline: {
    position: "absolute",
    left: 0,
    right: 0,
    top: BASELINE_Y,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: Theme.colors.cardBorder,
  },
  strip: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  // Zero-width anchor at the horizontal centre of the strip, giving the ticks
  // an origin to be absolutely positioned against without measuring anything.
  origin: {
    width: 0,
  },
  tickSlot: {
    position: "absolute",
    top: BASELINE_Y,
    width: TICK_SLOT_WIDTH,
    alignItems: "center",
  },
  tickMajor: {
    width: 2,
    height: MAJOR_TICK_HEIGHT,
    borderRadius: 1,
    backgroundColor: Theme.colors.cardBorder,
  },
  tickMinor: {
    width: 1.5,
    height: MINOR_TICK_HEIGHT,
    borderRadius: 1,
    backgroundColor: Theme.colors.cardBorder,
    opacity: 0.7,
  },
  tickLabel: {
    marginTop: 3,
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  caretLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 9,
    alignItems: "center",
  },
  caretArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Theme.colors.secondary,
  },
  caretStem: {
    width: 2,
    height: MAJOR_TICK_HEIGHT + BASELINE_Y - 14,
    borderRadius: 1,
    backgroundColor: Theme.colors.secondary,
  },
  homeMarkerLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    alignItems: "center",
  },
  homeMarker: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Theme.colors.white,
  },
});
