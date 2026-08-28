import React, { useCallback, useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import AuthProviders, { type AuthMethod } from "@/components/AuthProviders";
import { type EmailAuthMode } from "@/components/EmailAuthSheet";
import {
  Headline,
  MarshmallowStage,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { useAuth } from "@/contexts/AuthContext";
import { track } from "@/lib/analytics";

/**
 * The front door.
 *
 * Every account's data lives on the server, so there is nothing to show and
 * nothing to save before we know who this is — signing in comes first, and
 * onboarding runs afterwards for an account that hasn't finished it.
 *
 * The character here is a stock one rather than the user's: theirs is chosen
 * during onboarding, which by definition hasn't happened yet.
 */
const PREVIEW_COLOR = MARSHMALLOW_COLORS[0].hex;
const PREVIEW_NAME = "Marshmallow";

export default function AuthGateScreen() {
  const { user } = useAuth();

  // Navigation away from here belongs to the guard in the root layout; this
  // only reports the attempt it started. The ref keeps a session that was
  // already restored on mount from counting as a signup.
  const attemptedRef = useRef(false);
  const reportedRef = useRef(false);

  useEffect(() => {
    if (!user || !attemptedRef.current || reportedRef.current) return;
    reportedRef.current = true;
    track("signup_completed");
  }, [user]);

  const handleAttempt = useCallback((method: AuthMethod, mode?: EmailAuthMode) => {
    attemptedRef.current = true;
    track("signup_started", mode ? { method, mode } : { method });
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false, animation: "fade" }} />

      <OnboardingLayout progress={null} scroll>
        <View style={styles.stage}>
          <MarshmallowStage
            color={PREVIEW_COLOR}
            name={PREVIEW_NAME}
            scale={0.56}
            entrance
          />
        </View>

        <Headline>Grow a Marshmallow{"\n"}by staying off your phone.</Headline>
        <Supporting style={styles.supporting}>
          Sign in to pick up where you left off, or create an account to start.
        </Supporting>

        <AuthProviders onAttempt={handleAttempt} style={styles.providers} />
      </OnboardingLayout>
    </>
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
});
