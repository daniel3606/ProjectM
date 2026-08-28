import { Button, Screen, ScreenSubtitle, ScreenTitle } from "@/components/ui";
import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import {
  resolveAppRoute,
  isValidSignupOtp,
  sanitizeSignupOtpInput,
  SIGNUP_OTP_MAX_LENGTH,
} from "@/lib/auth";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
} from "react-native";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";
  const {
    isEmailVerified,
    signOut,
    resendVerificationEmail,
    verifySignupOtp,
  } = useAuth();
  const { onboardingCompleted, isProfileReady } = useMarshmallowProfile();

  const [otp, setOtp] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    if (!isProfileReady || !isEmailVerified) return;
    router.replace(resolveAppRoute("authenticated", onboardingCompleted));
  }, [isProfileReady, isEmailVerified, onboardingCompleted, router]);

  const onResend = async () => {
    if (resendLoading) return;
    if (!email) {
      setError("Missing email address. Go back and sign up again.");
      return;
    }
    setError("");
    setInfo("");
    setResendLoading(true);
    try {
      const { error: resendError } = await resendVerificationEmail(email);
      if (resendError) {
        setError(resendError);
      } else {
        setInfo("Verification email sent. Check your inbox and spam folder.");
      }
    } finally {
      setResendLoading(false);
    }
  };

  const onVerifyCode = async () => {
    if (verifyLoading) return;
    if (!email) {
      setError("Missing email address. Go back and sign up again.");
      return;
    }
    if (!isValidSignupOtp(otp)) {
      setError(`Enter the ${SIGNUP_OTP_MAX_LENGTH}-digit code from your email.`);
      return;
    }
    setError("");
    setInfo("");
    setVerifyLoading(true);
    try {
      const { error: verifyError } = await verifySignupOtp(email, otp.trim());
      if (verifyError) {
        setError(verifyError);
      } else {
        setInfo("Email verified!");
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Screen scroll contentContainerStyle={styles.content}>
          <ScreenTitle>Check Your Email</ScreenTitle>
          <ScreenSubtitle style={styles.subtitle}>
            {email
              ? `We sent a verification email to ${email}. Enter the ${SIGNUP_OTP_MAX_LENGTH}-digit code from that email to continue.`
              : `We sent a verification email. Enter the ${SIGNUP_OTP_MAX_LENGTH}-digit code from that email to continue.`}
          </ScreenSubtitle>

          <Text style={styles.label}>Verification code</Text>
          <TextInput
            style={styles.input}
            value={otp}
            onChangeText={(value) => setOtp(sanitizeSignupOtpInput(value))}
            placeholder="12345678"
            placeholderTextColor={Theme.colors.gray}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={SIGNUP_OTP_MAX_LENGTH}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}

          <Button
            label="Verify Code"
            onPress={onVerifyCode}
            loading={verifyLoading}
            style={styles.primaryButton}
          />
          <Button
            label="Resend Verification Email"
            variant="outline"
            onPress={onResend}
            loading={resendLoading}
          />
          <Pressable
            onPress={async () => {
              await signOut();
              router.replace("/");
            }}
            style={styles.link}
          >
            <Text style={styles.linkText}>Use a different email</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={styles.link}>
            <Text style={styles.linkText}>Back</Text>
          </Pressable>
        </Screen>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Theme.spacing.xxxl,
    gap: Theme.spacing.md,
  },
  subtitle: {
    marginBottom: Theme.spacing.lg,
  },
  label: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: Theme.spacing.sm,
  },
  input: {
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    fontSize: 24,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: 8,
    textAlign: "center",
  },
  error: {
    color: Theme.colors.danger,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
  },
  info: {
    color: Theme.colors.secondary,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
  },
  primaryButton: {
    marginTop: Theme.spacing.sm,
  },
  link: {
    alignItems: "center",
    paddingVertical: Theme.spacing.sm,
  },
  linkText: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
});
