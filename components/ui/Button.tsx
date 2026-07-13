import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

type ButtonVariant = "primary" | "danger" | "outline" | "ghost";
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label/icon and disables the button. */
  loading?: boolean;
  variant?: ButtonVariant;
  icon?: IoniconName;
  iconPosition?: "left" | "right";
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

const ICON_COLOR: Record<ButtonVariant, string> = {
  primary: Theme.colors.white,
  danger: Theme.colors.white,
  outline: Theme.colors.secondary,
  ghost: Theme.colors.danger,
};

/**
 * Shared CTA used across onboarding, screen actions and sheet forms.
 * Variants mirror the button treatments already in the app:
 *  - primary: big colored CTA with shadow (e.g. "Start Focus Session")
 *  - danger:  destructive/active-stop actions (e.g. "End Focus Session")
 *  - outline: small pill button on a bordered card (e.g. "Choose Apps")
 *  - ghost:   text-only destructive action (e.g. "Delete Block")
 */
export default function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  icon,
  iconPosition = "left",
  iconSize = 20,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const iconColor = ICON_COLOR[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        VARIANT_STYLES[variant],
        pressed && !isDisabled && PRESSED_STYLES[variant],
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons name={icon} size={iconSize} color={iconColor} />
          )}
          <Text style={[TEXT_VARIANT_STYLES[variant], textStyle]}>{label}</Text>
          {icon && iconPosition === "right" && (
            <Ionicons name={icon} size={iconSize} color={iconColor} />
          )}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  disabled: {
    opacity: 0.5,
  },
});

const VARIANT_STYLES: Record<ButtonVariant, ViewStyle> = StyleSheet.create({
  primary: {
    backgroundColor: Theme.colors.secondary,
    borderRadius: Theme.radius.lg,
    paddingVertical: 16,
    ...Theme.shadows.button,
  },
  danger: {
    backgroundColor: Theme.colors.danger,
    borderRadius: Theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  outline: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 20,
    gap: 6,
  },
  ghost: {
    backgroundColor: "transparent",
    paddingVertical: 14,
    gap: 8,
  },
});

const PRESSED_STYLES: Record<ButtonVariant, ViewStyle> = StyleSheet.create({
  primary: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  danger: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  outline: { opacity: 0.7 },
  ghost: { opacity: 0.7 },
});

const TEXT_VARIANT_STYLES: Record<ButtonVariant, TextStyle> = StyleSheet.create({
  primary: { fontSize: 18, fontFamily: Theme.fonts.semibold, color: Theme.colors.white },
  danger: { fontSize: 15, fontFamily: Theme.fonts.semibold, color: Theme.colors.white },
  outline: { fontSize: 14, fontFamily: Theme.fonts.medium, color: Theme.colors.secondary },
  ghost: { fontSize: 15, fontFamily: Theme.fonts.semibold, color: Theme.colors.danger },
});
