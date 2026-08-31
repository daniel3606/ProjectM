import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import OnboardingButton from "@/components/OnboardingButton";
import { Screen, HeroTitle, HeroSubtitle } from "@/components/ui";

const PREMIUM_FEATURES = [
  { icon: "lock-closed", label: "Hard Block mode you can't exit early" },
  { icon: "infinite", label: "Unlimited scheduled blocks" },
  { icon: "stats-chart", label: "Detailed screen time insights" },
  { icon: "people", label: "Compete with friends on leaderboards" },
] as const;

/**
 * Deliberately outside onboarding: a new user meets the product and their
 * marshmallow first, and is offered premium later from inside the app.
 */
export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "card",
          animation: "default",
        }}
      />

      <Screen style={styles.container}>
        <Pressable
          onPress={close}
          hitSlop={12}
          style={[styles.closeButton, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={28} color={Theme.colors.gray} />
        </Pressable>

        <View style={styles.content}>
          <HeroTitle>Unlock{"\n"}Marshmallow Premium</HeroTitle>
          <HeroSubtitle>Grow faster and stay focused with premium</HeroSubtitle>

          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((feature) => (
              <View key={feature.label} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons
                    name={feature.icon}
                    size={20}
                    color={Theme.colors.secondary}
                  />
                </View>
                <Text style={styles.featureText}>{feature.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <OnboardingButton
          label="Start Free Trial"
          onPress={close}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
  },
  closeButton: {
    position: "absolute",
    right: 20,
    zIndex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  featureList: {
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontFamily: Theme.fonts.medium,
    fontSize: 16,
    color: Theme.colors.text,
  },
});
