import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import OnboardingButton from "@/components/OnboardingButton";
import { Screen, HeroTitle, HeroSubtitle, SelectableOption } from "@/components/ui";

const SCREEN_TIME_OPTIONS = [
  "Less than 2 hrs/day",
  "2-4 hrs/day",
  "4-6 hrs/day",
  "6-8 hrs/day",
  "8+ hrs/day",
] as const;

export default function OnboardingScreenTime() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "card",
          animation: "default",
        }}
      />

      <Screen topInset={40} style={styles.container}>
        <View style={styles.content}>
          <HeroTitle>What's your{"\n"}average screen time?</HeroTitle>
          <HeroSubtitle>We'll use this to set your starting point</HeroSubtitle>

          <View style={styles.optionList}>
            {SCREEN_TIME_OPTIONS.map((option) => (
              <SelectableOption
                key={option}
                label={option}
                selected={selected === option}
                onPress={() => setSelected(option)}
              />
            ))}
          </View>
        </View>

        <OnboardingButton
          label="Next"
          disabled={!selected}
          onPress={() => router.push("/onboarding-premium")}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  optionList: {
    gap: 12,
  },
});
