import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useRouter } from "expo-router";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import EmailAuthSheet, { type EmailAuthMode } from "@/components/EmailAuthSheet";
import { Button } from "@/components/ui";
import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { isAppleAuthAvailable } from "@/lib/appleAuth";

export type AuthMethod = "apple" | "google" | "email";

interface AuthProvidersProps {
  /**
   * Reported before an attempt begins, so the caller can record it in whatever
   * terms its own surface uses — onboarding counts a signup, Settings doesn't.
   */
  onAttempt?: (method: AuthMethod, mode?: EmailAuthMode) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Apple, Google and email sign-in, plus the sheet the email option opens.
 *
 * Shared by the onboarding account step and Settings so a guest who skipped
 * signing up during onboarding meets the same three options later.
 */
export default function AuthProviders({ onAttempt, style }: AuthProvidersProps) {
  const router = useRouter();
  const { user, signInWithApple, signInWithGoogle, isAuthBusy } = useAuth();

  const sheetRef = useRef<BottomSheetModal>(null);
  const [emailMode, setEmailMode] = useState<EmailAuthMode>("signup");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [pending, setPending] = useState<AuthMethod | null>(null);

  useEffect(() => {
    let cancelled = false;
    isAppleAuthAvailable().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A session can arrive while the sheet is still up (email sign-in, or a
  // provider round trip), and the form behind it is no longer meaningful.
  useEffect(() => {
    if (user) sheetRef.current?.dismiss();
  }, [user]);

  const runProvider = useCallback(
    async (method: Exclude<AuthMethod, "email">) => {
      if (isAuthBusy) return;
      onAttempt?.(method);
      setPending(method);
      try {
        await (method === "apple" ? signInWithApple() : signInWithGoogle());
      } finally {
        setPending(null);
      }
    },
    [isAuthBusy, onAttempt, signInWithApple, signInWithGoogle]
  );

  const openEmail = useCallback(
    (mode: EmailAuthMode) => {
      onAttempt?.("email", mode);
      setEmailMode(mode);
      sheetRef.current?.present();
    },
    [onAttempt]
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
      <View style={[styles.providers, style]}>
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
          testID="auth-switch-to-sign-in"
        >
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign In</Text>
          </Text>
        </Pressable>
      </View>

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
  providers: {
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
  pressed: {
    opacity: 0.6,
  },
});
