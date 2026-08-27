import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import type { EquippedItems } from "@/constants/items";
import { hapticEmphasis, hapticLight } from "@/lib/haptics";
import MarshmallowStage from "./MarshmallowStage";

/**
 * Phase timings. The whole loop runs in under three seconds: long enough that
 * the cause and effect land in order, short enough that nobody feels held.
 */
const PHASE_SESSION_STARTS_MS = 250;
const PHASE_APPS_BLOCKED_MS = 900;
const PHASE_GROWS_MS = 2150;
const PHASE_DONE_MS = 2700;

const FOCUS_BAR_FILL_MS = PHASE_GROWS_MS - PHASE_APPS_BLOCKED_MS;
const STEP_FADE_MS = 320;
const TILE_FADE_MS = 480;

const GROWN_SCALE = 1.16;

const APP_GLYPHS = ["play", "camera", "chatbubble"] as const;

const STEPS = [
  "Start a Focus Session",
  "Stay away from distracting apps",
  "Marshmallow grows",
] as const;

/** 0 at rest, 1 session started, 2 apps blocked and time passing, 3 grown. */
type Phase = 0 | 1 | 2 | 3;

interface GrowthLoopSequenceProps {
  color: string;
  name: string;
  items?: EquippedItems;
  /** Start at the end state for someone who has already watched this once. */
  skip?: boolean;
  onComplete: () => void;
}

/**
 * The whole product in one animation: a session starts, distractions close,
 * time passes, the marshmallow is bigger than it was. Nothing here is
 * decoration — each moving part is one link in that chain.
 */
export default function GrowthLoopSequence({
  color,
  name,
  items,
  skip = false,
  onComplete,
}: GrowthLoopSequenceProps) {
  const [phase, setPhase] = useState<Phase>(skip ? 3 : 0);

  const tiles = useSharedValue(skip ? 1 : 0);
  const focusBar = useSharedValue(skip ? 1 : 0);

  useEffect(() => {
    if (skip) {
      onComplete();
      return;
    }

    const timers = [
      setTimeout(() => {
        setPhase(1);
        hapticLight();
      }, PHASE_SESSION_STARTS_MS),
      setTimeout(() => setPhase(2), PHASE_APPS_BLOCKED_MS),
      setTimeout(() => {
        setPhase(3);
        hapticEmphasis();
      }, PHASE_GROWS_MS),
      setTimeout(onComplete, PHASE_DONE_MS),
    ];

    return () => timers.forEach(clearTimeout);
    // Replaying the sequence on a new callback identity would restart the story.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  useEffect(() => {
    if (phase < 2) return;
    tiles.value = withTiming(1, { duration: TILE_FADE_MS, easing: Easing.out(Easing.cubic) });
    focusBar.value = withTiming(1, {
      duration: skip ? 0 : FOCUS_BAR_FILL_MS,
      easing: Easing.inOut(Easing.quad),
    });
  }, [focusBar, phase, skip, tiles]);

  const tileStyle = useAnimatedStyle(() => ({
    opacity: 1 - tiles.value * 0.78,
    transform: [{ scale: 1 - tiles.value * 0.06 }],
  }));

  const focusBarStyle = useAnimatedStyle(() => ({
    width: `${focusBar.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.tileRow, tileStyle]}>
        {APP_GLYPHS.map((glyph) => (
          <View key={glyph} style={styles.tile}>
            <Ionicons name={glyph} size={19} color="rgba(28,28,30,0.42)" />
          </View>
        ))}
      </Animated.View>

      <MarshmallowStage
        color={color}
        name={name}
        items={items}
        scale={0.52}
        growth={phase >= 3 ? GROWN_SCALE : 1}
      />

      <View style={styles.focusBarTrack}>
        <Animated.View style={[styles.focusBarFill, focusBarStyle]} />
      </View>

      <View style={styles.steps}>
        {STEPS.map((label, index) => (
          <SequenceStep key={label} label={label} active={phase >= index + 1} />
        ))}
      </View>
    </View>
  );
}

function SequenceStep({ label, active }: { label: string; active: boolean }) {
  const emphasis = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    emphasis.value = withTiming(active ? 1 : 0, {
      duration: STEP_FADE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [active, emphasis]);

  const rowStyle = useAnimatedStyle(() => ({
    opacity: 0.36 + emphasis.value * 0.64,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + emphasis.value * 0.75,
    transform: [{ scale: 0.72 + emphasis.value * 0.28 }],
  }));

  return (
    <Animated.View style={[styles.stepRow, rowStyle]}>
      <Animated.View style={[styles.stepDot, dotStyle]} />
      <Text style={styles.stepLabel}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  tileRow: {
    flexDirection: "row",
    gap: 12,
  },
  tile: {
    width: 46,
    height: 46,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.white,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  focusBarTrack: {
    width: 132,
    height: 3,
    borderRadius: 2,
    marginTop: 4,
    backgroundColor: "rgba(139,99,92,0.14)",
    overflow: "hidden",
  },
  focusBarFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: Theme.colors.secondary,
  },
  steps: {
    marginTop: 28,
    gap: 12,
    alignSelf: "stretch",
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Theme.colors.secondary,
  },
  stepLabel: {
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.text,
  },
});
