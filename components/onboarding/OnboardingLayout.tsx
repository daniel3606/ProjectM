import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import OnboardingProgress from "./OnboardingProgress";

/** Every onboarding screen shares this gutter, so nothing shifts between steps. */
export const ONBOARDING_GUTTER = 28;

interface OnboardingLayoutProps {
  /** 0–1, or null on screens that shouldn't show progress (intro, hand-off). */
  progress?: number | null;
  onBack?: () => void;
  /** The CTA block. Pinned above the home indicator at the same height on every screen. */
  footer?: React.ReactNode;
  /** Turns the body into a ScrollView, for screens whose content can outgrow a small phone. */
  scroll?: boolean;
  /** Lifts the footer above the keyboard. Only needed on screens with a text field. */
  keyboardAware?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * The frame the whole flow is built on: safe-area padding, a hairline progress
 * bar, an optional back affordance, and a CTA anchored at a fixed height.
 *
 * Screens supply only their content, which is what keeps the sequence feeling
 * like one continuous story rather than eleven separate forms.
 */
export default function OnboardingLayout({
  progress = null,
  onBack,
  footer,
  scroll,
  keyboardAware,
  contentStyle,
  children,
}: OnboardingLayoutProps) {
  const insets = useSafeAreaInsets();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      bounces={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.content, contentStyle]}>{children}</View>
  );

  const frame = (
    <>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={Theme.colors.secondary} />
          </Pressable>
        ) : (
          <View style={styles.backButton} />
        )}

        <View style={styles.progressSlot}>
          {progress === null ? null : <OnboardingProgress value={progress} />}
        </View>

        <View style={styles.backButton} />
      </View>

      {body}

      {footer ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {frame}
        </KeyboardAvoidingView>
      ) : (
        frame
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: ONBOARDING_GUTTER - 12,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.55,
  },
  progressSlot: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  content: {
    paddingHorizontal: ONBOARDING_GUTTER,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: ONBOARDING_GUTTER,
  },
  footer: {
    paddingHorizontal: ONBOARDING_GUTTER,
    paddingTop: 8,
  },
});
