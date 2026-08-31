import { getStageForSize, isObjectRevealed } from "@/constants/growthStages";
import Theme from "@/constants/theme";
import { worldXToSize } from "@/lib/growthWorld";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  useAnimatedReaction,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/**
 * Text content cannot be animated on the UI thread, so this is the one place
 * in the scene that crosses back to JS while the camera moves. Pushes are
 * limited to every few frames, and the exact final value always gets through
 * once the camera settles.
 */
const UPDATE_EVERY_N_FRAMES = 3;

function quantizeCm(cm: number) {
  "worklet";
  return Math.round(cm * 10) / 10;
}

function formatCm(cm: number) {
  return cm.toFixed(1);
}

interface SizeIndicatorProps {
  cameraX: SharedValue<number>;
  /**
   * The marshmallow's own world position. The resting readout follows this
   * rather than the camera, so it stays the marshmallow's real size even when
   * the camera has pulled ahead toward a running block's goal.
   */
  marshmallowWorldX: SharedValue<number>;
  previewProgress: SharedValue<number>;
  /** The marshmallow's real stored size, used to gate undiscovered copy. */
  actualSizeCm: number;
  /**
   * Growth a running block will pay out, shown between the number and the
   * unit as "3.5 (+2.0) cm" — the same readout the home screen widget gives.
   */
  pendingGrowthCm?: number;
}

/**
 * The readout for whatever size the camera is pointing at. Kept as its own
 * component so the state updates that drive the counting number re-render two
 * `Text` nodes and nothing else — the scene above it never re-renders while
 * dragging.
 */
export default function SizeIndicator({
  cameraX,
  marshmallowWorldX,
  previewProgress,
  actualSizeCm,
  pendingGrowthCm,
}: SizeIndicatorProps) {
  const [displayCm, setDisplayCm] = useState(actualSizeCm);
  const lastPushedCm = useSharedValue(actualSizeCm);
  const framesSincePush = useSharedValue(0);

  useAnimatedReaction(
    // Resting, the number is the marshmallow's own size; only while the camera
    // is under the finger does it read whatever the camera is pointing at.
    () =>
      previewProgress.value > 0 ? cameraX.value : marshmallowWorldX.value,
    (current, previous) => {
      framesSincePush.value += 1;

      // While the camera is genuinely moving, only push every few frames. Once
      // it settles the frame delta collapses and the resting value gets
      // through immediately.
      const isMoving = previous !== null && Math.abs(current - previous) > 0.5;
      if (isMoving && framesSincePush.value < UPDATE_EVERY_N_FRAMES) return;

      const cm = quantizeCm(worldXToSize(current));
      if (cm === lastPushedCm.value) return;

      lastPushedCm.value = cm;
      framesSincePush.value = 0;
      scheduleOnRN(setDisplayCm, cm);
    },
  );

  // The bracket next to the number belongs to the marshmallow either way, so
  // it swaps content rather than appearing and disappearing: pending growth
  // while the camera is home, the size being left behind while it is away.
  // Each has to be unmounted rather than faded, since an invisible node still
  // holds its width and would leave a gap before the unit.
  const [isPreviewing, setIsPreviewing] = useState(false);
  useAnimatedReaction(
    () => previewProgress.value > 0,
    (previewing, wasPreviewing) => {
      if (wasPreviewing === null || previewing === wasPreviewing) return;
      scheduleOnRN(setIsPreviewing, previewing);
    },
  );

  const stage = getStageForSize(displayCm);
  const isRevealed = isObjectRevealed(actualSizeCm, stage.sizeCm);

  // Scrubbed back onto its own size, the bracket would just repeat the number.
  const showsOwnSize = formatCm(displayCm) !== formatCm(actualSizeCm);

  return (
    <View style={styles.container}>
      <View style={styles.sizeRow}>
        <Text style={styles.size}>{formatCm(displayCm)}</Text>
        {isPreviewing
          ? showsOwnSize && (
              <Text style={styles.originalSize}>({formatCm(actualSizeCm)})</Text>
            )
          : pendingGrowthCm != null &&
            pendingGrowthCm > 0 && (
              <Text style={styles.growth}>(+{formatCm(pendingGrowthCm)})</Text>
            )}
        <Text style={styles.unit}>cm</Text>
      </View>

      <Text style={styles.message} numberOfLines={2}>
        {isRevealed ? stage.message : "Not there yet — keep focusing."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: Theme.spacing.md,
  },
  sizeRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  size: {
    fontSize: 50,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  growth: {
    fontSize: 24,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.success,
    marginLeft: 4,
  },
  /** The size being scrubbed away from. Carries the number's own colour so it
      reads as a fact about the marshmallow rather than as a gain. */
  originalSize: {
    fontSize: 24,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    marginLeft: 4,
  },
  unit: {
    fontSize: 24,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.textSecondary,
    marginLeft: 2,
  },
  message: {
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    marginTop: Theme.spacing.xxs,
  },
});
