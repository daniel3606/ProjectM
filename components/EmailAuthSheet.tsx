import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Theme from "@/constants/theme";
import { Button } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { validateSignInInput, validateSignUpInput } from "@/lib/auth";

export type EmailAuthMode = "login" | "signup";

interface EmailAuthSheetProps {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  mode: EmailAuthMode;
  onModeChange: (mode: EmailAuthMode) => void;
  /** Supabase needs an emailed code before the session counts as verified. */
  onNeedsVerification: (email: string) => void;
}

/**
 * Email sign-in and sign-up, in a sheet.
 *
 * Kept out of the screen that opens it so the surrounding flow stays visible
 * behind it — the user is adding an account to the marshmallow they just made,
 * not leaving for a registration page.
 */
export default function EmailAuthSheet({
  sheetRef,
  mode,
  onModeChange,
  onNeedsVerification,
}: EmailAuthSheetProps) {
  const snapPoints = useMemo(() => [mode === "login" ? "64%" : "76%"], [mode]);

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

  return (
    <BottomSheetModal
      ref={sheetRef}
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
        contentContainerStyle={styles.content}
      >
        {mode === "login" ? (
          <SignInForm onNeedsVerification={onNeedsVerification} />
        ) : (
          <SignUpForm onNeedsVerification={onNeedsVerification} />
        )}

        <Pressable
          onPress={() => onModeChange(mode === "login" ? "signup" : "login")}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {mode === "login"
              ? "Don't have an account? Sign up"
              : "Already have an account? Sign in"}
          </Text>
        </Pressable>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

/**
 * Password field with an eye toggle.
 *
 * Masked by default; people mistype long passwords on a phone keyboard often
 * enough that hiding the text with no way to check it costs more than it buys.
 */
function PasswordInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.passwordRow}>
      <BottomSheetTextInput
        style={[styles.input, styles.passwordInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme.colors.gray}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable
        onPress={() => setVisible((shown) => !shown)}
        style={styles.passwordToggle}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={Theme.colors.gray}
        />
      </Pressable>
    </View>
  );
}

function SignInForm({
  onNeedsVerification,
}: {
  onNeedsVerification: (email: string) => void;
}) {
  const { signIn, isAuthBusy } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (loading || isAuthBusy) return;
    const validationError = validateSignInInput(email.trim(), password);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: signInError, needsVerification } = await signIn(email, password);
      if (signInError) setError(signInError);
      if (needsVerification) onNeedsVerification(email.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Sign in</Text>

      <Text style={styles.label}>Email</Text>
      <BottomSheetTextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email@example.com"
        placeholderTextColor={Theme.colors.gray}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={styles.label}>Password</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Sign In"
        onPress={onSubmit}
        loading={loading}
        disabled={isAuthBusy && !loading}
        style={styles.submit}
      />
    </View>
  );
}

function SignUpForm({
  onNeedsVerification,
}: {
  onNeedsVerification: (email: string) => void;
}) {
  const { signUp, isAuthBusy } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (loading || isAuthBusy) return;
    const validationError = validateSignUpInput(email.trim(), password, confirmPassword);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { error: signUpError, needsConfirmation } = await signUp(email, password);
      if (signUpError) {
        setError(signUpError);
      } else if (needsConfirmation) {
        onNeedsVerification(email.trim());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Create account</Text>

      <Text style={styles.label}>Email</Text>
      <BottomSheetTextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="email@example.com"
        placeholderTextColor={Theme.colors.gray}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      <Text style={styles.label}>Password</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
      />

      <Text style={styles.label}>Confirm password</Text>
      <PasswordInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        label="Create Account"
        onPress={onSubmit}
        loading={loading}
        disabled={isAuthBusy && !loading}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Theme.colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...Theme.shadows.sheet,
  },
  handleIndicator: {
    width: 40,
    backgroundColor: Theme.colors.gray,
    opacity: 0.35,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    marginTop: 12,
  },
  input: {
    width: "100%",
    marginTop: 6,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
  },
  passwordRow: {
    justifyContent: "center",
  },
  passwordInput: {
    // Room for the eye button so long passwords don't run under it.
    paddingRight: 52,
  },
  passwordToggle: {
    position: "absolute",
    right: 6,
    top: 6,
    bottom: 0,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    marginTop: 10,
    color: Theme.colors.danger,
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
  },
  submit: {
    marginTop: 22,
  },
  toggle: {
    marginTop: 20,
    alignItems: "center",
    paddingVertical: 8,
  },
  toggleText: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
  },
});
