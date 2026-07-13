import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import OnboardingButton from "@/components/OnboardingButton";
import { Screen, HeroTitle, HeroSubtitle, SelectableOption } from "@/components/ui";

const PURPOSE_OPTIONS = [
  "Cut down on social media",
  "Boost focus & productivity",
  "Break phone addiction",
  "Just exploring",
] as const;

export default function OnboardingPurpose() {
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
          <HeroTitle>What matters{"\n"}most to you?</HeroTitle>
          <HeroSubtitle>Tell us why you're joining Marshmallow</HeroSubtitle>

          <View style={styles.optionList}>
            {PURPOSE_OPTIONS.map((option) => (
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
          onPress={() => router.push("/onboarding-screentime")}
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
