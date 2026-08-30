import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Theme from "@/constants/theme";
import { getStageForSize, isObjectRevealed } from "@/constants/growthStages";
import { worldXToSize } from "@/lib/growthWorld";

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
  previewProgress: SharedValue<number>;
  /** The marshmallow's real stored size, used to gate undiscovered copy. */
  actualSizeCm: number;
}

/**
 * The readout for whatever size the camera is pointing at. Kept as its own
 * component so the state updates that drive the counting number re-render two
 * `Text` nodes and nothing else — the scene above it never re-renders while
 * dragging.
 */
export default function SizeIndicator({
  cameraX,
  previewProgress,
  actualSizeCm,
}: SizeIndicatorProps) {
  const [displayCm, setDisplayCm] = useState(actualSizeCm);
  const lastPushedCm = useSharedValue(actualSizeCm);
  const framesSincePush = useSharedValue(0);

  useAnimatedReaction(
    () => cameraX.value,
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

  const previewStyle = useAnimatedStyle(() => ({
    opacity: previewProgress.value,
  }));

  const stage = getStageForSize(displayCm);
  const isRevealed = isObjectRevealed(actualSizeCm, stage.sizeCm);

  return (
    <View style={styles.container}>
      <View style={styles.sizeRow}>
        <Text style={styles.size}>{formatCm(displayCm)}</Text>
        <Text style={styles.unit}>cm</Text>
      </View>

      <Text style={styles.message} numberOfLines={2}>
        {isRevealed ? stage.message : "Not there yet — keep focusing."}
      </Text>

      <Animated.View style={[styles.previewHint, previewStyle]}>
        <Text style={styles.previewHintText}>
          You are {formatCm(actualSizeCm)}cm · release to go back
        </Text>
      </Animated.View>
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
  previewHint: {
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.xxs,
    borderRadius: Theme.radius.pill,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  previewHintText: {
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },
});
