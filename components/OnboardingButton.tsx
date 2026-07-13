import React from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui";

interface OnboardingButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

/** Primary CTA anchored above the home indicator, used across the onboarding flow. */
export default function OnboardingButton({
  label,
  onPress,
  disabled,
}: OnboardingButtonProps) {
  const insets = useSafeAreaInsets();

  return (
    <Button
      label={label}
      onPress={onPress}
      disabled={disabled}
      style={{ marginHorizontal: 32, marginBottom: insets.bottom + 24 }}
    />
  );
}
