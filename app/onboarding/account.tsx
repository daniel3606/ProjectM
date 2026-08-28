import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import {
  Headline,
  MarshmallowStage,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import EmailAuthSheet, { type EmailAuthMode } from "@/components/EmailAuthSheet";
import { Button } from "@/components/ui";
import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { track } from "@/lib/analytics";
import { isAppleAuthAvailable } from "@/lib/appleAuth";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

type Provider = "apple" | "google" | "email";

/**
 * Authentication sits here, near the end, on purpose: by now the user has a
 * marshmallow they chose and a number they care about, so an account reads as
 * protecting that rather than as a gate in front of the product.
 */
export default function OnboardingAccountStep() {
  const router = useRouter();
  const profile = useMarshmallowProfile();
  const { signInWithApple, signInWithGoogle, isAuthBusy } = useAuth();
  const { isAuthenticated, signupStarted, markSignupStarted } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("account");

  const sheetRef = useRef<BottomSheetModal>(null);
  const [emailMode, setEmailMode] = useState<EmailAuthMode>("signup");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<Provider | null>(null);
  const advancedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    isAppleAuthAvailable().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Covers both signing in on this screen and coming back from email
  // verification, which re-enters onboarding and resumes here.
  useEffect(() => {
    if (!isAuthenticated || advancedRef.current) return;
    advancedRef.current = true;
    // Only an attempt made from this flow counts as a completion. Someone who
    // was already signed in and is passing back through has not just signed up.
    if (signupStarted) track("signup_completed");
    sheetRef.current?.dismiss();
    goNext();
  }, [goNext, isAuthenticated, signupStarted]);

  const runProvider = useCallback(
    async (provider: Exclude<Provider, "email">) => {
      if (isAuthBusy) return;
      track("signup_started", { method: provider });
      markSignupStarted();
      setPending(provider);
      try {
        await (provider === "apple" ? signInWithApple() : signInWithGoogle());
      } finally {
        setPending(null);
      }
    },
    [isAuthBusy, markSignupStarted, signInWithApple, signInWithGoogle]
  );

  const openEmail = useCallback(
    (mode: EmailAuthMode) => {
      track("signup_started", { method: "email", mode });
      markSignupStarted();
      setEmailMode(mode);
      sheetRef.current?.present();
    },
    [markSignupStarted]
  );

  const handleNeedsVerification = useCallback(
    (email: string) => {
      sheetRef.current?.dismiss();
      router.push({ pathname: "/auth/verify", params: { email } });
    },
    [router]
  );

  return (
    <>
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

        <View style={styles.providers}>
          {Platform.OS === "ios" && appleAvailable ? (
            <View
              pointerEvents={isAuthBusy ? "none" : "auto"}
              style={isAuthBusy ? styles.busy : undefined}
            >
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={Theme.radius.lg}
                style={styles.appleButton}
                onPress={() => runProvider("apple")}
              />
            </View>
          ) : null}

          <Button
            label="Continue with Google"
            variant="outline"
            icon="logo-google"
            onPress={() => runProvider("google")}
            loading={pending === "google"}
            disabled={isAuthBusy && pending !== "google"}
            style={styles.providerButton}
            textStyle={styles.providerText}
          />

          <Button
            label="Continue with Email"
            variant="outline"
            icon="mail-outline"
            onPress={() => openEmail("signup")}
            disabled={isAuthBusy}
            style={styles.providerButton}
            textStyle={styles.providerText}
          />

          <Pressable
            onPress={() => openEmail("login")}
            hitSlop={8}
            style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
          >
            <Text style={styles.signInText}>
              Already have an account? <Text style={styles.signInLink}>Sign In</Text>
            </Text>
          </Pressable>
        </View>
      </OnboardingLayout>

      <EmailAuthSheet
        sheetRef={sheetRef}
        mode={emailMode}
        onModeChange={setEmailMode}
        onNeedsVerification={handleNeedsVerification}
      />
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
    gap: 12,
  },
  appleButton: {
    width: "100%",
    height: 52,
  },
  busy: {
    opacity: 0.5,
  },
  providerButton: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: Theme.radius.lg,
  },
  providerText: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  signIn: {
    alignSelf: "center",
    paddingVertical: 10,
    marginTop: 4,
  },
  signInText: {
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
    color: Theme.colors.textSecondary,
  },
  signInLink: {
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
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
