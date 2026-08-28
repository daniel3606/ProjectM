import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  CountUp,
  FadeIn,
  OnboardingCTA,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import Theme from "@/constants/theme";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticEmphasis } from "@/lib/haptics";
import {
  describeYears,
  formatScreenTime,
  formatYears,
} from "@/lib/onboardingTime";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * The one screen in the flow that deliberately holds attention, and the
 * timings are the whole design:
 *
 *   200ms   the cost lands, in years rather than minutes
 *   600ms   the number they get back starts counting
 *   1400ms  it lands, with a single haptic
 *   1450ms  the daily and yearly context follows
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

/** One rendered step of the count. A tenth of a year is the precision we show. */
const COUNT_QUANTUM_YEARS = 0.1;

export default function OnboardingReclaimedStep() {
  const router = useRouter();
  const { isReady, reclaimedTime, lifetimeScreenTime, markReclaimedTimeViewed } =
    useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("reclaimed");

  const [framingVisible, setFramingVisible] = useState(false);
  const [contextVisible, setContextVisible] = useState(false);
  const [ctaVisible, setCtaVisible] = useState(false);

  // Both answers and an age band are needed before there is anything to show.
  // Whichever is missing, the earliest gap is the one worth sending them to.
  useEffect(() => {
    if (!isReady) return;
    if (!reclaimedTime) {
      router.replace("/onboarding/current-time");
      return;
    }
    if (!lifetimeScreenTime) router.replace("/onboarding/age");
  }, [isReady, lifetimeScreenTime, reclaimedTime, router]);

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
  const daysPerYear = lifetimeScreenTime?.daysPerYear ?? 0;
  const yearsLost = lifetimeScreenTime?.yearsLost ?? 0;
  const yearsReclaimed = lifetimeScreenTime?.yearsReclaimed ?? 0;

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
          <Supporting style={styles.cost}>
            At this pace you&apos;ll spend {daysPerYear} days on your phone this year.
            That&apos;s <Text style={styles.costYears}>{describeYears(yearsLost)}</Text>{" "}
            of the life ahead of you.
          </Supporting>
        </FadeIn>

        <FadeIn visible={framingVisible}>
          <Supporting style={styles.framing}>Your goal gives you back</Supporting>
        </FadeIn>

        <CountUp
          value={yearsReclaimed}
          quantum={COUNT_QUANTUM_YEARS}
          format={(years) => `${formatYears(years)} years`}
          accessibilityLabel={`${describeYears(yearsReclaimed)} of your life`}
          delayMs={COUNT_DELAY_MS}
          durationMs={COUNT_DURATION_MS}
          onSettled={handleSettled}
          style={styles.hero}
        />

        <FadeIn visible={framingVisible}>
          <Supporting style={styles.framing}>of your life.</Supporting>
        </FadeIn>

        <FadeIn visible={contextVisible} style={styles.context}>
          <Text style={styles.daily}>{formatScreenTime(dailyMinutes)} every day</Text>
          <Text style={styles.footnote}>
            Starting with the next Focus Session you run.
          </Text>
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
  cost: {
    marginBottom: 36,
    fontSize: 17,
    lineHeight: 25,
    color: Theme.colors.text,
  },
  costYears: {
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.attention,
  },
  framing: {
    fontSize: 18,
  },
  hero: {
    color: Theme.colors.secondary,
  },
  context: {
    marginTop: 40,
    alignItems: "center",
    gap: 8,
  },
  daily: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 19,
    color: Theme.colors.text,
    textAlign: "center",
  },
  footnote: {
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    color: Theme.colors.gray,
    textAlign: "center",
  },
});
