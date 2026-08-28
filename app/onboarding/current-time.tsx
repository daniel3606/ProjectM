import React, { useCallback, useEffect } from "react";
import { StyleSheet, View } from "react-native";
import {
  Headline,
  MetricValue,
  OnboardingCTA,
  OnboardingLayout,
  TimeSlider,
} from "@/components/onboarding";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { track } from "@/lib/analytics";
import {
  DEFAULT_CURRENT_MINUTES,
  MAX_SCREEN_TIME_MINUTES,
  MIN_CURRENT_MINUTES,
  SCREEN_TIME_STEP_MINUTES,
  formatScreenTime,
} from "@/lib/onboardingTime";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

export default function OnboardingCurrentTimeStep() {
  const { currentScreenTimeMinutes, setCurrentScreenTime } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("current-time");

  // The slider always opens on a real answer rather than an empty control, so
  // a user who agrees with the default can simply continue.
  useEffect(() => {
    if (currentScreenTimeMinutes === null) {
      setCurrentScreenTime(DEFAULT_CURRENT_MINUTES);
    }
  }, [currentScreenTimeMinutes, setCurrentScreenTime]);

  const minutes = currentScreenTimeMinutes ?? DEFAULT_CURRENT_MINUTES;

  const handleContinue = useCallback(() => {
    track("onboarding_current_screentime_set", { minutes });
    goNext();
  }, [goNext, minutes]);

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      footer={<OnboardingCTA label="Continue" onPress={handleContinue} />}
    >
      <Headline style={styles.headline}>
        How much time do you{"\n"}spend on your phone{"\n"}each day?
      </Headline>

      <View style={styles.control}>
        <MetricValue>{formatScreenTime(minutes)}</MetricValue>

        <TimeSlider
          minMinutes={MIN_CURRENT_MINUTES}
          maxMinutes={MAX_SCREEN_TIME_MINUTES}
          stepMinutes={SCREEN_TIME_STEP_MINUTES}
          value={minutes}
          onChange={setCurrentScreenTime}
        />
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
    gap: 28,
    paddingBottom: 24,
  },
});
