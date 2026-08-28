import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AuthProviders, { type AuthMethod } from "@/components/AuthProviders";
import {
  Headline,
  MarshmallowStage,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import { type EmailAuthMode } from "@/components/EmailAuthSheet";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { track } from "@/lib/analytics";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * Authentication sits here, near the end, on purpose: by now the user has a
 * marshmallow they chose and a number they care about, so an account reads as
 * protecting that rather than as a gate in front of the product.
 */
export default function OnboardingAccountStep() {
  const profile = useMarshmallowProfile();
  const { isAuthenticated, signupStarted, markSignupStarted } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("account");

  const advancedRef = useRef(false);

  // Covers both signing in on this screen and coming back from email
  // verification, which re-enters onboarding and resumes here.
  useEffect(() => {
    if (!isAuthenticated || advancedRef.current) return;
    advancedRef.current = true;
    // Only an attempt made from this flow counts as a completion. Someone who
    // was already signed in and is passing back through has not just signed up.
    if (signupStarted) track("signup_completed");
    goNext();
  }, [goNext, isAuthenticated, signupStarted]);

  const handleAttempt = useCallback(
    (method: AuthMethod, mode?: EmailAuthMode) => {
      track("signup_started", mode ? { method, mode } : { method });
      markSignupStarted();
    },
    [markSignupStarted]
  );

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      scroll
      footer={
        <Pressable
          onPress={goNext}
          hitSlop={8}
          style={({ pressed }) => [styles.later, pressed && styles.pressed]}
        >
          <Text style={styles.laterText}>Not now</Text>
        </Pressable>
      }
    >
      <View style={styles.stage}>
        <MarshmallowStage
          color={profile.color}
          name={profile.name}
          items={profile.items}
          scale={0.56}
        />
      </View>

      <Headline>Save your Marshmallow.</Headline>
      <Supporting style={styles.supporting}>
        Create an account to keep your progress safe.
      </Supporting>

      <AuthProviders onAttempt={handleAttempt} style={styles.providers} />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  stage: {
    marginTop: 12,
    marginBottom: 24,
  },
  supporting: {
    marginTop: 12,
  },
  providers: {
    marginTop: "auto",
    paddingTop: 32,
  },
  later: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  laterText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    color: Theme.colors.gray,
  },
  pressed: {
    opacity: 0.6,
  },
});
