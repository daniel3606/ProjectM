import Theme from "@/constants/theme";
import { useAuth, useSignIn, useSignUp } from "@clerk/expo";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AuthMode = "login" | "signup";

function SignInForm() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!signIn) {
      setError("Authentication is still loading. Please wait.");
      return;
    }
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: pwError } = await signIn.password({
        identifier: email,
        password,
      });
      if (pwError) {
        setError(pwError.longMessage ?? pwError.message ?? "Sign in failed");
        return;
      }
      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize();
        if (finalizeError) {
          setError(finalizeError.longMessage ?? finalizeError.message ?? "Failed to complete sign in");
          return;
        }
      } else {
        setError("Sign in incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(err.longMessage ?? err.message ?? "Sign in failed");
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

      <Pressable
        style={({ pressed }) => [
          formStyles.submitButton,
          pressed && formStyles.pressed,
        ]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Theme.colors.white} />
        ) : (
          <Text style={formStyles.submitText}>Log In</Text>
        )}
      </Pressable>
    </View>
  );
}

function SignUpForm() {
  const { signUp } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!signUp) {
      setError("Authentication is still loading. Please wait.");
      return;
    }
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: createError } = await signUp.create({
        emailAddress: email,
        password,
      });
      if (createError) {
        setError(createError.longMessage ?? createError.message ?? "Sign up failed");
        return;
      }
      if (signUp.status === "complete") {
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setError(finalizeError.longMessage ?? finalizeError.message ?? "Failed to complete sign up");
          return;
        }
      } else {
        const { error: codeError } = await signUp.verifications.sendEmailCode();
        if (codeError) {
          setError(codeError.longMessage ?? codeError.message ?? "Failed to send verification email");
          return;
        }
        setPendingVerification(true);
      }
    } catch (err: any) {
      setError(err.longMessage ?? err.message ?? "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    if (!signUp) {
      setError("Authentication is still loading. Please wait.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode({
        code,
      });
      if (verifyError) {
        setError(verifyError.longMessage ?? verifyError.message ?? "Verification failed");
        return;
      }
      if (signUp.status === "complete") {
        const { error: finalizeError } = await signUp.finalize();
        if (finalizeError) {
          setError(finalizeError.longMessage ?? finalizeError.message ?? "Failed to complete sign up");
          return;
        }
      }
    } catch (err: any) {
      setError(err.longMessage ?? err.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <View style={formStyles.form}>
        <Text style={formStyles.title}>Verify Email</Text>
        <Text style={formStyles.subtitle}>
          Enter the code sent to {email}
        </Text>

        <Text style={formStyles.label}>Verification Code</Text>
        <BottomSheetTextInput
          style={formStyles.input}
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          placeholderTextColor={Theme.colors.gray}
          keyboardType="number-pad"
        />

        {error ? <Text style={formStyles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            formStyles.submitButton,
            pressed && formStyles.pressed,
          ]}
          onPress={onVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Theme.colors.white} />
          ) : (
            <Text style={formStyles.submitText}>Verify</Text>
          )}
        </Pressable>
      </View>
    );
  }

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

      <Pressable
        style={({ pressed }) => [
          formStyles.submitButton,
          pressed && formStyles.pressed,
        ]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={Theme.colors.white} />
        ) : (
          <Text style={formStyles.submitText}>Sign Up</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const router = useRouter();
  const { isSignedIn } = useAuth();

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/custominit");
    }
  }, [isSignedIn, router]);

  const snapPoints = useMemo(() => ["60%"], []);

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
      <Text style={styles.welcomeTitle}>
        Welcome to{"\n"}Marshmallow
      </Text>

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
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonPrimary,
            pressed && styles.pressed,
          ]}
          onPress={() => openSheet("login")}
        >
          <Text style={styles.buttonPrimaryText}>Log In</Text>
        </Pressable>
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
        <Pressable onPress={()=> router.replace("/custominit")}>
          <Text style={styles.buttonSignUpText}>Continue As Guest</Text>
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
  submitButton: {
    backgroundColor: Theme.colors.secondary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  pressed: {
    opacity: 0.8,
  },
  submitText: {
    color: Theme.colors.white,
    fontFamily: Theme.fonts.semibold,
    fontSize: 18,
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
  buttonPrimary: {
    backgroundColor: Theme.colors.secondary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonPrimaryText: {
    color: Theme.colors.white,
    fontFamily: Theme.fonts.semibold,
    fontSize: 18,
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
