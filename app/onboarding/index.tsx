import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import {
  FadeIn,
  Headline,
  MarshmallowStage,
  OnboardingCTA,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticLight } from "@/lib/haptics";
import { onboardingRoute } from "@/lib/onboardingSteps";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * The opening is paced so the marshmallow arrives before the words and the
 * words before the button — about a second in total. It is not a loading
 * delay: everything on screen is already doing something.
 */
const COPY_AT_MS = 420;
const CTA_AT_MS = 950;

const COMPACT_HEIGHT = 700;

export default function OnboardingIntro() {
  const router = useRouter();
  const profile = useMarshmallowProfile();
  const { height } = useWindowDimensions();
  const {
    isReady,
    isCompleted,
    resumeStep,
    hasSeenIntro,
    markIntroSeen,
  } = useOnboarding();
  const { goNext } = useOnboardingStep("intro");

  // A revisit shouldn't re-pace what the user has already watched.
  const instant = hasSeenIntro;
  const [copyVisible, setCopyVisible] = useState(instant);
  const [ctaVisible, setCtaVisible] = useState(instant);
  const redirectedRef = useRef(false);

  // Also the landing spot after email verification, so it doubles as the
  // flow's resume point rather than restarting a half-finished onboarding.
  useEffect(() => {
    if (!isReady || redirectedRef.current) return;

    if (isCompleted) {
      redirectedRef.current = true;
      router.replace("/(tabs)");
      return;
    }
    if (resumeStep && resumeStep !== "intro") {
      redirectedRef.current = true;
      router.replace(onboardingRoute(resumeStep));
    }
  }, [isCompleted, isReady, resumeStep, router]);

  useEffect(() => {
    if (instant) return;
    const timers = [
      setTimeout(() => setCopyVisible(true), COPY_AT_MS),
      setTimeout(() => setCtaVisible(true), CTA_AT_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [instant]);

  const handleSettled = useCallback(() => {
    if (instant) return;
    // The one haptic on this screen, and only once the character has landed —
    // opening the app should never buzz on its own.
    hapticLight();
  }, [instant]);

  const handleStart = useCallback(() => {
    markIntroSeen();
    goNext();
  }, [goNext, markIntroSeen]);

  return (
    <OnboardingLayout
      progress={null}
      footer={
        <OnboardingCTA label="Get Started" onPress={handleStart} revealed={ctaVisible} />
      }
    >
      <View style={styles.stage}>
        <MarshmallowStage
          color={profile.color}
          name={profile.name}
          items={profile.items}
          scale={height < COMPACT_HEIGHT ? 0.8 : 1}
          entrance={!instant}
          float
          onEntranceSettled={handleSettled}
        />

        <FadeIn visible={copyVisible} style={styles.copy}>
          <Headline>Grow your focus.</Headline>
          <Supporting style={styles.supporting}>
            Spend less time distracted and watch Marshmallow grow.
          </Supporting>
        </FadeIn>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    justifyContent: "center",
  },
  copy: {
    marginTop: 44,
  },
  supporting: {
    marginTop: 14,
    paddingHorizontal: 8,
  },
});
