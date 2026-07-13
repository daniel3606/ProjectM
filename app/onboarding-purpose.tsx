import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import OnboardingButton from "@/components/OnboardingButton";

const PURPOSE_OPTIONS = [
  "Cut down on social media",
  "Boost focus & productivity",
  "Break phone addiction",
  "Just exploring",
] as const;

export default function OnboardingPurpose() {
  const insets = useSafeAreaInsets();
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

      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <View style={styles.content}>
          <Text style={styles.title}>What matters{"\n"}most to you?</Text>
          <Text style={styles.subtitle}>
            Tell us why you're joining Marshmallow
          </Text>

          <View style={styles.optionList}>
            {PURPOSE_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => setSelected(option)}
                style={({ pressed }) => [
                  styles.option,
                  selected === option && styles.optionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected === option && styles.optionTextSelected,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <OnboardingButton
          label="Next"
          disabled={!selected}
          onPress={() => router.push("/onboarding-screentime")}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  title: {
    textAlign: "center",
    fontFamily: Theme.fonts.bold,
    fontSize: 32,
    padding: 10,
  },
  subtitle: {
    textAlign: "center",
    fontFamily: Theme.fonts.regular,
    fontSize: 15,
    color: Theme.colors.textSecondary,
    marginBottom: 32,
  },
  optionList: {
    gap: 12,
  },
  option: {
    backgroundColor: Theme.colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  optionSelected: {
    borderColor: Theme.colors.secondary,
    borderWidth: 2,
    backgroundColor: "#FFF8F0",
  },
  optionText: {
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.text,
    textAlign: "center",
  },
  optionTextSelected: {
    color: Theme.colors.secondary,
    fontFamily: Theme.fonts.semibold,
  },
  pressed: {
    opacity: 0.7,
  },
});
