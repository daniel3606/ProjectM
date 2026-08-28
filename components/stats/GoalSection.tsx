import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Theme from "@/constants/theme";
import { formatMinutes } from "@/lib/stats/format";
import type { GoalModel } from "@/lib/stats/types";
import EmptyState from "./EmptyState";
import StatsSection from "./StatsSection";

const FILL_DURATION_MS = 420;

interface GoalSectionProps {
  model: GoalModel;
  /** Replays the meter fill when the period changes. */
  animationKey: string;
}

/**
 * A single horizontal meter rather than a ring, so it reads as the same family
 * as the bars above it. Going over target is stated plainly and never in red.
 */
export default function GoalSection({ model, animationKey }: GoalSectionProps) {
  if (model.unavailable) {
    return (
      <StatsSection title="Your Goal">
        <EmptyState
          icon="flag-outline"
          title={model.unavailable === "no-source" ? "No usage to measure yet" : "Set your starting point"}
          body={
            model.unavailable === "no-source"
              ? "Your daily target will track itself once Marshmallow can read your screen time."
              : "Tell Marshmallow your typical screen time and it will suggest a daily target."
          }
        />
      </StatsSection>
    );
  }

  const isOver = model.differenceMinutes > 0;

  return (
    <StatsSection title="Your Goal" subtitle={model.suggested ? "Suggested from your starting point" : undefined}>
      <View style={styles.card}>
        <View style={styles.figures}>
          <View>
            <Text style={styles.figureLabel}>Target</Text>
            <Text style={styles.figureValue}>
              {formatMinutes(model.targetMinutesPerDay)}
              <Text style={styles.perDay}>/day</Text>
            </Text>
          </View>

          <View style={styles.figureRight}>
            <Text style={styles.figureLabel}>Current</Text>
            <Text style={styles.figureValue}>
              {formatMinutes(model.currentMinutesPerDay)}
              <Text style={styles.perDay}>/day</Text>
            </Text>
          </View>
        </View>

        <Meter progress={model.progress} isOver={isOver} animationKey={animationKey} />

        <Text style={styles.interpretation} testID="stats-goal-interpretation">
          {model.interpretation}
        </Text>
      </View>
    </StatsSection>
  );
}

function Meter({
  progress,
  isOver,
  animationKey,
}: {
  progress: number;
  isOver: boolean;
  animationKey: string;
}) {
  const fill = useSharedValue(0);

  useEffect(() => {
    fill.value = 0;
    fill.value = withTiming(progress, {
      duration: FILL_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [fill, progress, animationKey]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, isOver ? styles.fillOver : styles.fillOnTrack, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: Theme.spacing.xl,
  },
  figures: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.lg,
  },
  figureRight: {
    alignItems: "flex-end",
  },
  figureLabel: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginBottom: 2,
  },
  figureValue: {
    fontSize: 22,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.5,
  },
  perDay: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.track,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  fillOnTrack: {
    backgroundColor: Theme.colors.positive,
  },
  fillOver: {
    backgroundColor: Theme.colors.secondary,
  },
  interpretation: {
    marginTop: Theme.spacing.md,
    fontSize: 14.5,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    opacity: 0.8,
  },
});
