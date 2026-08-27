import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  GrowthLoopSequence,
  Headline,
  OnboardingCTA,
  OnboardingLayout,
} from "@/components/onboarding";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

export default function OnboardingHowItWorksStep() {
  const profile = useMarshmallowProfile();
  const { hasSeenGrowthExplainer, markGrowthExplainerSeen } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("how-it-works");

  const [ctaVisible, setCtaVisible] = useState(hasSeenGrowthExplainer);

  const handleComplete = useCallback(() => {
    setCtaVisible(true);
    markGrowthExplainerSeen();
  }, [markGrowthExplainerSeen]);

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      footer={
        <OnboardingCTA
          label="Grow Marshmallow"
          onPress={goNext}
          revealed={ctaVisible}
        />
      }
    >
      <Headline style={styles.headline}>Your focus helps{"\n"}Marshmallow grow.</Headline>

      <View style={styles.sequence}>
        <GrowthLoopSequence
          color={profile.color}
          name={profile.name}
          items={profile.items}
          skip={hasSeenGrowthExplainer}
          onComplete={handleComplete}
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  sequence: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 20,
  },
});
