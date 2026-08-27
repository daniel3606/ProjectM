import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CountUpDuration,
  FadeIn,
  OnboardingCTA,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import Theme from "@/constants/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticEmphasis } from "@/lib/haptics";
import { describeWeekly, describeYearly } from "@/lib/onboardingTime";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * The one screen in the flow that deliberately holds attention, and the
 * timings are the whole design:
 *
 *   200ms   the framing appears
 *   600ms   the number starts counting
 *   1400ms  it lands, with a single haptic
 *   1450ms  the weekly and yearly context follows
 *   1900ms  the CTA arrives
 *
 * Roughly two seconds, none of it a spinner — the user is watching their own
 * number being worked out.
 */
const FRAMING_AT_MS = 200;
const COUNT_DELAY_MS = 600;
const COUNT_DURATION_MS = 800;
const CONTEXT_AT_MS = 1450;
const CTA_AT_MS = 1900;

export default function OnboardingReclaimedStep() {
  const router = useRouter();
  const { isReady, reclaimedTime, markReclaimedTimeViewed } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("reclaimed");

  const [framingVisible, setFramingVisible] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  useEffect(() => {
    if (isReady && !reclaimedTime) {
      router.replace("/onboarding/current-time");
    }
  }, [isReady, reclaimedTime, router]);

  useEffect(() => {
    const timers = [
      setTimeout(() => setFramingVisible(true), FRAMING_AT_MS),
      setTimeout(() => setContextVisible(true), CONTEXT_AT_MS),
      setTimeout(() => setCtaVisible(true), CTA_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleSettled = useCallback(() => {
    hapticEmphasis();
    markReclaimedTimeViewed();
  }, [markReclaimedTimeViewed]);

  const dailyMinutes = reclaimedTime?.dailyMinutes ?? 0;

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      footer={
        <OnboardingCTA label="Continue" onPress={goNext} revealed={ctaVisible} />
      }
    >
      <View style={styles.body}>
        <FadeIn visible={framingVisible}>
          <Supporting style={styles.framing}>You could get back</Supporting>
        </FadeIn>

        <CountUpDuration
          minutes={dailyMinutes}
          delayMs={COUNT_DELAY_MS}
          durationMs={COUNT_DURATION_MS}
          onSettled={handleSettled}
        />

        <FadeIn visible={framingVisible}>
          <Supporting style={styles.framing}>every day</Supporting>
        </FadeIn>

        <FadeIn visible={contextVisible} style={styles.context}>
          <Text style={styles.weekly}>{describeWeekly(dailyMinutes)}</Text>
          <Text style={styles.yearly}>{describeYearly(dailyMinutes)}</Text>
        </FadeIn>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  framing: {
    fontSize: 18,
  },
  context: {
    marginTop: 44,
    alignItems: "center",
    gap: 8,
  },
  weekly: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 19,
    color: Theme.colors.text,
    textAlign: "center",
  },
  yearly: {
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    color: Theme.colors.gray,
    textAlign: "center",
  },
});
