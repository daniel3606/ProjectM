import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  FadeIn,
  Headline,
  MarshmallowStage,
  OnboardingLayout,
} from "@/components/onboarding";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticLight } from "@/lib/haptics";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * The line needs to hold for about a second after it lands, or the beat reads
 * as a flicker on the way somewhere else rather than a moment of its own.
 */
const COPY_AT_MS = 520;
const HAND_OFF_AT_MS = 1750;

/**
 * A beat between setup and the app itself, rather than a jump cut into Home.
 * No completion modal, no confetti — just the character the user made, named
 * as ready, and then the real screen.
 */
export default function OnboardingReadyStep() {
  const router = useRouter();
  const profile = useMarshmallowProfile();
  const { completeOnboarding } = useOnboarding();
  useOnboardingStep("ready");

  const [copyVisible, setCopyVisible] = useState(false);
  const handedOffRef = useRef(false);

  useEffect(() => {
    const copyTimer = setTimeout(() => setCopyVisible(true), COPY_AT_MS);

    const handOffTimer = setTimeout(() => {
      if (handedOffRef.current) return;
      handedOffRef.current = true;
      // Subtle on purpose. Arriving at the app is not an achievement to
      // celebrate, and a medium tap here reads as one.
      hapticLight();
      // The completion flag is set synchronously inside; only the remote write
      // is asynchronous, and Home doesn't wait on it.
      void completeOnboarding();
      router.replace("/(tabs)");
    }, HAND_OFF_AT_MS);

    return () => {
      clearTimeout(copyTimer);
      clearTimeout(handOffTimer);
    };
  }, [completeOnboarding, router]);

  return (
    <>
      <Stack.Screen options={{ animation: "fade" }} />

      <OnboardingLayout progress={null}>
        <View style={styles.body}>
          <MarshmallowStage
            color={profile.color}
            name={profile.name}
            items={profile.items}
            scale={0.9}
            entrance
            entranceDelayMs={80}
          />

          <FadeIn visible={copyVisible} style={styles.copy}>
            <Headline>Your Marshmallow{"\n"}is ready.</Headline>
          </FadeIn>
        </View>
      </OnboardingLayout>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    justifyContent: "center",
    paddingBottom: 40,
  },
  copy: {
    marginTop: 40,
  },
});
