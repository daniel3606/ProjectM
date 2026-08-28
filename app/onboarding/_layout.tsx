import React from "react";
import { Stack } from "expo-router";
import Theme from "@/constants/theme";

/**
 * The onboarding flow is its own stack so the steps push and pop against each
 * other rather than against the app shell. Steps slide; the hand-off into Home
 * dissolves (set on the `ready` screen itself).
 */
export default function OnboardingStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: Theme.colors.background },
      }}
    />
  );
}
