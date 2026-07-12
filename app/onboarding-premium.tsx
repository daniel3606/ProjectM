import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import OnboardingButton from "@/components/OnboardingButton";

const PREMIUM_FEATURES = [
  { icon: "lock-closed", label: "Deep Focus mode with 1.5x growth" },
  { icon: "infinite", label: "Unlimited timed blocks" },
  { icon: "stats-chart", label: "Detailed screen time insights" },
  { icon: "people", label: "Compete with friends on leaderboards" },
] as const;

export default function OnboardingPremium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const finishOnboarding = () => {
    // custominit is presented as a fullScreenModal, and purpose/screentime/
    // premium are pushed inside that same modal stack. Dismiss the whole
    // modal before replacing, otherwise (tabs) just gets pushed on top of it.
    router.dismissAll();
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

      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Pressable
          onPress={finishOnboarding}
          hitSlop={12}
          style={[styles.closeButton, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={28} color={Theme.colors.gray} />
        </Pressable>

        <View style={styles.content}>
          <Text style={styles.title}>Unlock{"\n"}Marshmallow Premium</Text>
          <Text style={styles.subtitle}>
            Grow faster and stay focused with premium
          </Text>

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
          onPress={finishOnboarding}
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
