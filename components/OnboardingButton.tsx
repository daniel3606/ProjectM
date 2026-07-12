import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function OnboardingButton({
  label,
  onPress,
  disabled,
}: OnboardingButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { marginBottom: insets.bottom + 24 },
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: Theme.colors.secondary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 32,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: Theme.colors.white,
    fontFamily: Theme.fonts.semibold,
    fontSize: 18,
  },
});
