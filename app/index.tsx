import Theme from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";

type AuthMode = "login" | "signup";

function SignInForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: signInError } = await signIn(email, password);
      if (signInError) {
        setError(signInError);
      }
    } catch (err: any) {
      setError(err.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={formStyles.form}>
      <Text style={formStyles.title}>Log In</Text>

      <Text style={formStyles.label}>Email</Text>
      <BottomSheetTextInput
        style={formStyles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email@example.com"
        placeholderTextColor={Theme.colors.gray}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={formStyles.label}>Password</Text>
      <BottomSheetTextInput
        style={formStyles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={Theme.colors.gray}
        secureTextEntry
      />

      {error ? <Text style={formStyles.error}>{error}</Text> : null}

      <Button
        label="Log In"
        onPress={onSubmit}
        loading={loading}
        style={formStyles.submitButton}
      />
    </View>
  );
}

function SignUpForm() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const { error: signUpError, needsConfirmation } = await signUp(email, password);
      if (signUpError) {
        setError(signUpError);
      } else if (needsConfirmation) {
        setInfo("Check your email to confirm your account. If you already have an account, try logging in instead.");
      }
    } catch (err: any) {
      setError(err.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={formStyles.form}>
      <Text style={formStyles.title}>Sign Up</Text>

      <Text style={formStyles.label}>Email</Text>
      <BottomSheetTextInput
        style={formStyles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email@example.com"
        placeholderTextColor={Theme.colors.gray}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={formStyles.label}>Password</Text>
      <BottomSheetTextInput
        style={formStyles.input}
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor={Theme.colors.gray}
        secureTextEntry
      />

      <Text style={formStyles.label}>Confirm Password</Text>
      <BottomSheetTextInput
        style={formStyles.input}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm Password"
        placeholderTextColor={Theme.colors.gray}
        secureTextEntry
      />

      {error ? <Text style={formStyles.error}>{error}</Text> : null}
      {info ? <Text style={formStyles.info}>{info}</Text> : null}

      <Button
        label="Sign Up"
        onPress={onSubmit}
        loading={loading}
        style={formStyles.submitButton}
      />
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const router = useRouter();
  const { session, isLoading: authLoading } = useAuth();
  const { onboardingCompleted, isProfileReady } = useMarshmallowProfile();

  useEffect(() => {
    if (authLoading || !isProfileReady || !session) return;
    router.replace(onboardingCompleted ? "/(tabs)" : "/custominit");
  }, [authLoading, isProfileReady, session, onboardingCompleted, router]);

  const snapPoints = useMemo(
    () => [authMode === "login" ? "50%" : "60%"],
    [authMode]
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const openSheet = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    bottomSheetRef.current?.present();
  }, []);

  const toggleMode = useCallback(() => {
    setAuthMode((prev) => (prev === "login" ? "signup" : "login"));
  }, []);

  // Logged-in users are routed away once profile status is known; keep this
  // screen hidden so onboarding/home don't flash the welcome UI on refresh.
  if (authLoading || session) {
    return null;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <Text style={styles.welcomeTitle}>Marshmallow</Text>
      <Text style={styles.welcomeSubtitle}>The App Blocker You Needed</Text>

      <View style={styles.hero}>
        <View style={styles.bigEyes}>
          <View style={styles.bigEye}>
            <View style={styles.bigEyeHighlight} />
          </View>
          <View style={styles.bigEye}>
            <View style={styles.bigEyeHighlight} />
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Log In" onPress={() => openSheet("login")} />
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonSignUp,
            pressed && styles.pressed,
          ]}
          onPress={() => openSheet("signup")}
        >
          <Text style={styles.buttonSignUpText}>Sign Up</Text>
        </Pressable>
        <Pressable
          style={styles.guestButton}
          onPress={() => {
            if (!isProfileReady) return;
            router.replace(onboardingCompleted ? "/(tabs)" : "/custominit");
          }}
        >
          <Text style={styles.guestButtonText}>Continue As Guest</Text>
        </Pressable>
      </View>

      <BottomSheetModal
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.sheetScrollContent}
        >
          {authMode === "login" ? <SignInForm /> : <SignUpForm />}

          <Pressable onPress={toggleMode} style={styles.toggleLink}>
            <Text style={styles.toggleText}>
              {authMode === "login"
                ? "Don't have an account? Sign Up"
                : "Already have an account? Log In"}
            </Text>
          </Pressable>
        </BottomSheetScrollView>
      </BottomSheetModal>
    </View>
  );
}

const formStyles = StyleSheet.create({
  form: {
    gap: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 8,
  },
  input: {
    width: "100%",
    marginBottom: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  error: {
    color: Theme.colors.danger,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    marginTop: 4,
  },
  info: {
    color: Theme.colors.secondary,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    marginTop: 4,
  },
  submitButton: {
    marginTop: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 32,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: 42,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    textAlign: "center",
    marginTop: 20,
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    textAlign: "center",
    marginTop: 6,
  },
  bigEyes: {
    flexDirection: "row",
    gap: 122,
    alignItems: "center",
    justifyContent: "center",
  },
  bigEye: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2C2C2E",
    alignItems: "center",
    justifyContent: "center",
  },
  bigEyeHighlight: {
    position: "absolute",
    top: 12,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  actions: {
    paddingBottom: 60,
    gap: 10,
  },
  button: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
  buttonSignUp: {
    backgroundColor: "#FFF6ED",
    borderWidth: 2,
    borderColor: "#999",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonSignUpText: {
    color: "#999",
    fontFamily: Theme.fonts.semibold,
    fontSize: 18,
  },
  guestButton: {
    alignSelf: "center",
    paddingVertical: 8,
  },
  guestButtonText: {
    color: "#999",
    fontFamily: Theme.fonts.semibold,
    fontSize: 16,
    textDecorationLine: "underline",
  },
  sheetBackground: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  handleIndicator: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  sheetScrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  toggleLink: {
    marginTop: 20,
    alignItems: "center",
  },
  toggleText: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
});
