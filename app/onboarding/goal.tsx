import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  Headline,
  OnboardingCTA,
  OnboardingLayout,
  OnboardingOption,
  Supporting,
} from "@/components/onboarding";
import { ONBOARDING_GOALS } from "@/constants/onboarding";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

export default function OnboardingGoalStep() {
  const { goalIds, toggleGoal } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("goal");

  const handleContinue = useCallback(() => {
    if (goalIds.length === 0) return;
    goNext();
  }, [goalIds.length, goNext]);

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      scroll
      footer={
        <OnboardingCTA
          label="Continue"
          onPress={handleContinue}
          disabled={goalIds.length === 0}
        />
      }
    >
      <Headline style={styles.headline}>What would you like{"\n"}to change?</Headline>
      <Supporting style={styles.supporting}>Choose as many as you like.</Supporting>

      <View style={styles.options}>
        {ONBOARDING_GOALS.map((goal) => (
          <OnboardingOption
            key={goal.id}
            label={goal.label}
            selected={goalIds.includes(goal.id)}
            onPress={() => toggleGoal(goal.id)}
          />
        ))}
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  supporting: {
    marginTop: 12,
  },
  options: {
    marginTop: 32,
    gap: 10,
    paddingBottom: 16,
  },
});
