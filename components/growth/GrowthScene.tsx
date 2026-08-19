import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  cancelAnimation,
  Easing,
  useAnimatedReaction,
  useSharedValue,
  withDecay,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as Haptics from "expo-haptics";
import type { EquippedItems } from "@/constants/items";
import {
  CAMERA_MAX_X,
  CAMERA_MIN_X,
  DETENT_PX,
  GROUND_Y,
  GROWTH_OVERSHOOT_FRACTION,
  GROWTH_OVERSHOOT_MAX_PX,
  GROWTH_SWEEP_MS,
  RETURN_DWELL_MS,
  SCENE_HEIGHT,
  rubberBandToWorld,
  sizeToWorldX,
} from "@/lib/growthWorld";
import ComparisonWorld from "@/components/growth/ComparisonWorld";
import EdgeFade from "@/components/growth/EdgeFade";
import GrowthRuler from "@/components/growth/GrowthRuler";
import MarshmallowActor from "@/components/growth/MarshmallowActor";
import SizeIndicator from "@/components/growth/SizeIndicator";

const CAMERA_EASING = Easing.out(Easing.cubic);
const PULSE_EASING = Easing.out(Easing.quad);
const RETURN_SPRING = { damping: 20, stiffness: 85, mass: 1 } as const;
/** Eases the growth sweep back from its overshoot without a second bounce. */
const SETTLE_SPRING = { damping: 16, stiffness: 110, mass: 1 } as const;

/** Growth celebration: anticipate, launch, wobble to rest. */
const PULSE_SQUASH_MS = 130;
const PULSE_STRETCH_MS = 170;
const PULSE_SETTLE_SPRING = { damping: 7, stiffness: 190, mass: 0.7 } as const;
const RETURN_FADE_MS = 420;
const PREVIEW_FADE_IN_MS = 160;

/** Slightly snappier than the default so the fling settles within the world. */
const DECAY_DECELERATION = 0.994;

/**
 * A size change arriving this soon after mount is treated as stored state
 * loading in rather than as growth the user just earned, so the scene snaps to
 * it instead of animating and celebrating on every cold start.
 */
const HYDRATION_WINDOW_MS = 1500;

function fireDetentHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

function fireHomeHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/**
 * Hands the camera back to the marshmallow after a preview: it lingers on
 * whatever the user was looking at, then springs home and re-anchors. Because
 * the marshmallow is already at that world position, "re-anchoring" is just the
 * camera arriving — there is nothing to reposition.
 */
function returnCameraHome(
  cameraX: SharedValue<number>,
  marshmallowWorldX: SharedValue<number>,
  previewProgress: SharedValue<number>,
  isUserMotion: SharedValue<number>,
) {
  "worklet";
  isUserMotion.value = 0;
  previewProgress.value = withDelay(
    RETURN_DWELL_MS,
    withTiming(0, { duration: RETURN_FADE_MS }),
  );
  cameraX.value = withDelay(
    RETURN_DWELL_MS,
    withSpring(marshmallowWorldX.value, RETURN_SPRING),
  );
}

interface GrowthSceneProps {
  /** The marshmallow's real stored size. Changing this is what triggers growth. */
  sizeCm: number;
  color: string;
  name: string;
  isBlocking?: boolean;
  items?: EquippedItems;
  hapticsEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The growth scene: a horizontal scale world viewed through a camera.
 *
 * There is exactly one piece of animated truth here, `cameraX`, and the two
 * modes are only a question of who writes to it:
 *
 * - Normal mode: the camera holds the marshmallow's world position, so the
 *   marshmallow's screen offset is zero and it reads as anchored at the focal
 *   point. Growth moves its world position, the camera follows, and the world
 *   sweeps left behind it.
 * - Preview mode: the pan gesture writes the camera directly and the
 *   marshmallow drifts and rescales exactly like any other object, because it
 *   is governed by the same law. Nothing needs to be blended between the two
 *   states, and the marshmallow cannot jump.
 */
export default function GrowthScene({
  sizeCm,
  color,
  name,
  isBlocking,
  items,
  hapticsEnabled = true,
  style,
}: GrowthSceneProps) {
  const initialWorldX = useRef(sizeToWorldX(sizeCm)).current;

  const cameraX = useSharedValue(initialWorldX);
  const marshmallowWorldX = useSharedValue(initialWorldX);
  const previewProgress = useSharedValue(0);
  const growthPulse = useSharedValue(0);

  /** Where the marshmallow's real size says it should be. Growth moves this. */
  const targetWorldX = useSharedValue(initialWorldX);
  /** 1 when the next target change is stored state loading rather than growth. */
  const isHydrating = useSharedValue(0);

  /** Camera at the moment the finger went down, so the drag is absolute. */
  const cameraAtGestureStart = useSharedValue(initialWorldX);
  /** True through the drag *and* the fling that follows it, false once returning. */
  const isUserMotion = useSharedValue(0);
  const lastDetentIndex = useSharedValue(Math.round(initialWorldX / DETENT_PX));

  const mountedAtRef = useRef(Date.now());

  // The real size only has to reach the UI thread; every decision about what
  // to animate is made there, so it can read the interaction state without
  // racing against the gesture.
  useEffect(() => {
    isHydrating.value =
      Date.now() - mountedAtRef.current < HYDRATION_WINDOW_MS ? 1 : 0;
    targetWorldX.value = sizeToWorldX(sizeCm);
  }, [sizeCm, isHydrating, targetWorldX]);

  useAnimatedReaction(
    () => targetWorldX.value,
    (target, previous) => {
      if (previous === null || target === previous) return;

      if (isHydrating.value === 1) {
        marshmallowWorldX.value = target;
        cameraX.value = target;
        lastDetentIndex.value = Math.round(target / DETENT_PX);
        return;
      }

      // Growth arriving mid-drag or mid-fling moves the marshmallow's true
      // position but leaves the camera alone; the auto-return afterwards lands
      // on the new size.
      if (isUserMotion.value === 1) {
        marshmallowWorldX.value = withTiming(target, {
          duration: GROWTH_SWEEP_MS,
          easing: CAMERA_EASING,
        });
        return;
      }

      // The sweep carries a little past the new size and settles back, which
      // gives a small gain enough weight to feel earned. The camera and the
      // marshmallow each follow this identical path, so their difference —
      // which is all that screen position and scale depend on — stays zero
      // throughout, and the marshmallow holds the focal point exactly while
      // the world sweeps and settles beneath it.
      const overshoot = Math.min(
        Math.abs(target - previous) * GROWTH_OVERSHOOT_FRACTION,
        GROWTH_OVERSHOOT_MAX_PX,
      );
      const sweepTo = target + (target > previous ? overshoot : -overshoot);
      const grew = target > previous;

      // On growth the marshmallow squashes first and the world starts moving
      // as it springs back up, so the bounce reads as launching the sweep
      // rather than happening alongside it.
      const lead = grew ? PULSE_SQUASH_MS : 0;
      const sweep = () =>
        withDelay(
          lead,
          withSequence(
            withTiming(sweepTo, { duration: GROWTH_SWEEP_MS, easing: CAMERA_EASING }),
            withSpring(target, SETTLE_SPRING),
          ),
        );

      marshmallowWorldX.value = sweep();
      cameraX.value = sweep();

      if (grew) {
        growthPulse.value = withSequence(
          withTiming(-1, { duration: PULSE_SQUASH_MS, easing: PULSE_EASING }),
          withTiming(1, { duration: PULSE_STRETCH_MS, easing: PULSE_EASING }),
          withSpring(0, PULSE_SETTLE_SPRING),
        );
      }
    },
  );

  // Evenly spaced detents in world space, which in a logarithmic world means
  // even *ratio* steps, so the scrub feels equally notched at every size. The
  // marshmallow's own position gets a heavier bump so "home" is findable by
  // feel alone.
  useAnimatedReaction(
    () => cameraX.value,
    (current, previous) => {
      if (previous === null || !hapticsEnabled) return;
      if (isUserMotion.value === 0) return;

      const home = marshmallowWorldX.value;
      const crossedHome =
        (previous < home && current >= home) || (previous > home && current <= home);
      if (crossedHome) {
        lastDetentIndex.value = Math.round(current / DETENT_PX);
        scheduleOnRN(fireHomeHaptic);
        return;
      }

      const detent = Math.round(current / DETENT_PX);
      if (detent === lastDetentIndex.value) return;
      const skippedDetents = Math.abs(current - previous) > DETENT_PX;
      lastDetentIndex.value = detent;
      if (!skippedDetents) {
        scheduleOnRN(fireDetentHaptic);
      }
    },
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          "worklet";
          cancelAnimation(cameraX);
          cancelAnimation(previewProgress);
          cameraAtGestureStart.value = cameraX.value;
          isUserMotion.value = 1;
          lastDetentIndex.value = Math.round(cameraX.value / DETENT_PX);
          previewProgress.value = withTiming(1, { duration: PREVIEW_FADE_IN_MS });
        })
        .onUpdate((event) => {
          "worklet";
          // Dragging left pushes the camera forward through the world, so
          // larger objects arrive from the right — the same direction growth
          // moves the scene.
          cameraX.value = rubberBandToWorld(
            cameraAtGestureStart.value - event.translationX,
          );
        })
        .onEnd((event) => {
          "worklet";
          cameraX.value = withDecay(
            {
              velocity: -event.velocityX,
              clamp: [CAMERA_MIN_X, CAMERA_MAX_X],
              rubberBandEffect: true,
              deceleration: DECAY_DECELERATION,
            },
            (finished) => {
              "worklet";
              // Cancelled by a new touch — that gesture owns the camera now.
              if (!finished) return;
              returnCameraHome(
                cameraX,
                marshmallowWorldX,
                previewProgress,
                isUserMotion,
              );
            },
          );
        })
        .onFinalize((_event, wasActive) => {
          "worklet";
          // A touch that never became a drag still cancelled any return that
          // was pending, so it has to start a new one itself.
          if (wasActive) return;
          returnCameraHome(cameraX, marshmallowWorldX, previewProgress, isUserMotion);
        }),
    [cameraX, cameraAtGestureStart, isUserMotion, lastDetentIndex, marshmallowWorldX, previewProgress],
  );

  return (
    <View style={style}>
      <GestureDetector gesture={panGesture}>
        <View>
          <View style={styles.scene}>
            <View style={styles.ground} />

            <ComparisonWorld
              cameraX={cameraX}
              marshmallowWorldX={marshmallowWorldX}
              initialCameraX={initialWorldX}
            />

            <MarshmallowActor
              cameraX={cameraX}
              marshmallowWorldX={marshmallowWorldX}
              growthPulse={growthPulse}
              color={color}
              name={name}
              isBlocking={isBlocking}
              items={items}
            />

            {/* Above every object, below the marshmallow. */}
            <EdgeFade width={30} zIndex={900} />
          </View>

          <GrowthRuler
            cameraX={cameraX}
            marshmallowWorldX={marshmallowWorldX}
            previewProgress={previewProgress}
            color={color}
          />
        </View>
      </GestureDetector>

      <SizeIndicator
        cameraX={cameraX}
        previewProgress={previewProgress}
        actualSizeCm={sizeCm}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    height: SCENE_HEIGHT,
    position: "relative",
    overflow: "hidden",
  },
  ground: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: GROUND_Y,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.07)",
  },
});
