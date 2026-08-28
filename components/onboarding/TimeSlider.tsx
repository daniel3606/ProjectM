import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Theme from "@/constants/theme";
import { hapticSelection } from "@/lib/haptics";
import { formatScreenTime } from "@/lib/onboardingTime";

const KNOB_SIZE = 30;
const TRACK_HEIGHT = 6;
const ROW_HEIGHT = 48;
/** Long enough to read as deliberate, short enough not to lag the finger. */
const SYNC_MS = 170;

interface TimeSliderProps {
  minMinutes: number;
  maxMinutes: number;
  stepMinutes: number;
  value: number;
  onChange: (minutes: number) => void;
  /**
   * Optional wall the knob can't pass. The track beyond it stays visible but
   * dimmed, so the limit is something the user can see rather than a value
   * that silently refuses to move.
   */
  ceilingMinutes?: number;
  /** Labelled anchors under the two ends of the track. */
  showBounds?: boolean;
}

/**
 * A continuous control that reports in whole steps.
 *
 * The knob follows the finger on the UI thread, but the value only changes at
 * step boundaries — which is also the only time a haptic fires. That pairing is
 * what makes the slider feel like it has detents instead of buzzing per pixel.
 */
export default function TimeSlider({
  minMinutes,
  maxMinutes,
  stepMinutes,
  value,
  onChange,
  ceilingMinutes,
  showBounds = true,
}: TimeSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useSharedValue(0);
  const isDragging = useSharedValue(0);
  const lastStepIndex = useSharedValue(0);

  const ceiling = Math.min(ceilingMinutes ?? maxMinutes, maxMinutes);
  const span = Math.max(1, maxMinutes - minMinutes);
  const travel = Math.max(1, trackWidth - KNOB_SIZE);
  const ceilingProgress = (ceiling - minMinutes) / span;

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  // Keeps the knob honest when the value changes from outside a drag: a new
  // ceiling clamping the goal, or restored state loading in.
  useEffect(() => {
    if (isDragging.value === 1) return;
    const next = (value - minMinutes) / span;
    progress.value = withTiming(next, {
      duration: SYNC_MS,
      easing: Easing.out(Easing.cubic),
    });
    lastStepIndex.value = Math.round((value - minMinutes) / stepMinutes);
  }, [isDragging, lastStepIndex, minMinutes, progress, span, stepMinutes, value]);

  const commit = useCallback(
    (minutes: number, withTick: boolean) => {
      if (withTick) hapticSelection();
      onChange(minutes);
    },
    [onChange]
  );

  const gesture = useMemo(() => {
    // Declared alongside the gesture so the worklet closes over exactly the
    // geometry this instance was built with.
    const applyPosition = (x: number, allowTick: boolean) => {
      "worklet";
      const raw = (x - KNOB_SIZE / 2) / travel;
      const bounded = Math.max(minMinutes, Math.min(ceiling, minMinutes + raw * span));
      const snapped = Math.min(
        ceiling,
        minMinutes + Math.round((bounded - minMinutes) / stepMinutes) * stepMinutes
      );

      progress.value = (snapped - minMinutes) / span;

      const stepIndex = Math.round((snapped - minMinutes) / stepMinutes);
      if (stepIndex === lastStepIndex.value) return;

      // A fast flick crosses many steps at once; ticking for each of them
      // would be the exact buzzing this control exists to avoid.
      const crossedOneStep = Math.abs(stepIndex - lastStepIndex.value) === 1;
      lastStepIndex.value = stepIndex;
      scheduleOnRN(commit, snapped, allowTick && crossedOneStep);
    };

    return Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => {
        "worklet";
        isDragging.value = 1;
        applyPosition(event.x, false);
      })
      .onUpdate((event) => {
        "worklet";
        applyPosition(event.x, true);
      })
      .onFinalize(() => {
        "worklet";
        isDragging.value = 0;
      });
  }, [
    ceiling,
    commit,
    isDragging,
    lastStepIndex,
    minMinutes,
    progress,
    span,
    stepMinutes,
    travel,
  ]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * travel }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * travel + KNOB_SIZE / 2,
  }));

  const hasCeiling = ceiling < maxMinutes;

  const stepBy = useCallback(
    (direction: 1 | -1) => {
      const next = Math.min(ceiling, Math.max(minMinutes, value + direction * stepMinutes));
      if (next === value) return;
      commit(next, true);
    },
    [ceiling, commit, minMinutes, stepMinutes, value]
  );

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View
          style={styles.row}
          onLayout={onLayout}
          accessibilityRole="adjustable"
          accessibilityLabel="Daily screen time"
          accessibilityValue={{ text: formatScreenTime(value) }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") stepBy(1);
            if (event.nativeEvent.actionName === "decrement") stepBy(-1);
          }}
        >
          <View style={styles.track}>
            {hasCeiling ? (
              <View
                style={[
                  styles.blockedRegion,
                  { left: `${ceilingProgress * 100}%` },
                ]}
              />
            ) : null}
            <Animated.View style={[styles.fill, fillStyle]} />
          </View>

          <Animated.View style={[styles.knob, knobStyle]} />
        </View>
      </GestureDetector>

      {showBounds ? (
        <View style={styles.bounds}>
          <Text style={styles.boundLabel}>{formatScreenTime(minMinutes)}</Text>
          <Text style={styles.boundLabel}>{formatScreenTime(maxMinutes)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: ROW_HEIGHT,
    justifyContent: "center",
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: "rgba(139,99,92,0.14)",
    overflow: "hidden",
  },
  blockedRegion: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(28,28,30,0.06)",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Theme.colors.secondary,
  },
  knob: {
    position: "absolute",
    left: 0,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 5,
    elevation: 4,
  },
  bounds: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  boundLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    color: Theme.colors.gray,
  },
});
