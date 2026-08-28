import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import {
  Headline,
  OnboardingCTA,
  OnboardingLayout,
  OnboardingOption,
  Supporting,
} from "@/components/onboarding";
import { AGE_RANGES } from "@/constants/onboarding";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * A band rather than a birthday, because a band is all the arithmetic needs
 * and it is the least we can ask for. What it buys is the next few screens:
 * the cost of a phone habit is measured in the life left to spend on it, and
 * that is a very different number at 20 than it is at 60.
 */
export default function OnboardingAgeStep() {
  const { ageRangeId, setAgeRange } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("age");

  const handleContinue = useCallback(() => {
    if (!ageRangeId) return;
    goNext();
  }, [ageRangeId, goNext]);

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      scroll
      footer={
        <OnboardingCTA
          label="Continue"
          onPress={handleContinue}
          disabled={!ageRangeId}
        />
      }
    >
      <Headline style={styles.headline}>How old are you?</Headline>
      <Supporting style={styles.supporting}>
        We use this to work out what your screen time is costing you.
      </Supporting>

      <View style={styles.options}>
        {AGE_RANGES.map((range) => (
          <OnboardingOption
            key={range.id}
            label={range.label}
            selected={ageRangeId === range.id}
            onPress={() => setAgeRange(range.id)}
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
