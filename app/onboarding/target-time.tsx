import React, { useCallback, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  Headline,
  MetricValue,
  OnboardingCTA,
  OnboardingLayout,
  TimeSlider,
} from "@/components/onboarding";
import { SectionLabel } from "@/components/ui";
import Theme from "@/constants/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { track } from "@/lib/analytics";
import {
  DEFAULT_CURRENT_MINUTES,
  MAX_SCREEN_TIME_MINUTES,
  MIN_SCREEN_TIME_MINUTES,
  SCREEN_TIME_STEP_MINUTES,
  formatScreenTime,
  maxTargetMinutes,
  suggestTargetMinutes,
} from "@/lib/onboardingTime";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

export default function OnboardingTargetTimeStep() {
  const router = useRouter();
  const {
    isReady,
    currentScreenTimeMinutes,
    targetScreenTimeMinutes,
    setTargetScreenTime,
  } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("target-time");

  const current = currentScreenTimeMinutes ?? DEFAULT_CURRENT_MINUTES;
  const ceiling = maxTargetMinutes(current);

  // Nothing to aim at without a starting point; send the user back for one.
  useEffect(() => {
    if (isReady && currentScreenTimeMinutes === null) {
      router.replace("/onboarding/current-time");
    }
  }, [currentScreenTimeMinutes, isReady, router]);

  useEffect(() => {
    if (targetScreenTimeMinutes === null) {
      setTargetScreenTime(suggestTargetMinutes(current));
    }
  }, [current, setTargetScreenTime, targetScreenTimeMinutes]);

  const target = Math.min(targetScreenTimeMinutes ?? suggestTargetMinutes(current), ceiling);
  const atCeiling = target >= ceiling;

  const handleContinue = useCallback(() => {
    track("onboarding_target_screentime_set", {
      minutes: target,
      current_minutes: current,
    });
    goNext();
  }, [current, goNext, target]);

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      footer={<OnboardingCTA label="Continue" onPress={handleContinue} />}
    >
      <Headline style={styles.headline}>Where would you{"\n"}like to get?</Headline>

      <View style={styles.control}>
        <View style={styles.context}>
          <SectionLabel style={styles.contextLabel}>Current</SectionLabel>
          <Text style={styles.contextValue}>{formatScreenTime(current)}</Text>
        </View>

        <View>
          <SectionLabel style={styles.goalLabel}>Goal</SectionLabel>
          <MetricValue>{formatScreenTime(target)}</MetricValue>
        </View>

        <View>
          <TimeSlider
            minMinutes={MIN_SCREEN_TIME_MINUTES}
            maxMinutes={MAX_SCREEN_TIME_MINUTES}
            stepMinutes={SCREEN_TIME_STEP_MINUTES}
            value={target}
            onChange={setTargetScreenTime}
            ceilingMinutes={ceiling}
          />

          {atCeiling ? (
            <Text style={styles.ceilingNote}>
              Your goal stays below the time you spend today.
            </Text>
          ) : null}
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  control: {
    flex: 1,
    justifyContent: "center",
    gap: 26,
    paddingBottom: 24,
  },
  context: {
    alignItems: "center",
  },
  contextLabel: {
    textAlign: "center",
  },
  contextValue: {
    marginTop: 4,
    fontFamily: Theme.fonts.medium,
    fontSize: 20,
    color: Theme.colors.textSecondary,
  },
  goalLabel: {
    textAlign: "center",
    marginBottom: 4,
  },
  ceilingNote: {
    marginTop: 10,
    textAlign: "center",
    fontFamily: Theme.fonts.regular,
    fontSize: 13,
    color: Theme.colors.gray,
  },
});
