import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  Headline,
  MarshmallowStage,
  OnboardingCTA,
  OnboardingLayout,
  Supporting,
} from "@/components/onboarding";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface HowItWorksStep {
  icon: IoniconName;
  title: string;
  detail: string;
}

/**
 * Three sentences, in the order they happen. An earlier version animated the
 * same idea as a chain of moving parts and people couldn't tell what they were
 * being shown — the loop is simple enough to just say out loud.
 */
const STEPS: readonly HowItWorksStep[] = [
  {
    icon: "play",
    title: "Start a Focus Session",
    detail: "Choose how long you want to stay off your phone.",
  },
  {
    icon: "lock-closed",
    title: "Your distractions lock",
    detail: "The apps you pick stay shut until the session is over.",
  },
  {
    icon: "leaf",
    title: "Marshmallow grows",
    detail: "Every focused minute makes it a little bigger.",
  },
];

export default function OnboardingHowItWorksStep() {
  const profile = useMarshmallowProfile();
  const { progress, goBack, goNext } = useOnboardingStep("how-it-works");

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      scroll
      footer={<OnboardingCTA label="Grow Marshmallow" onPress={goNext} />}
    >
      <Headline style={styles.headline}>Your focus is{"\n"}what feeds it.</Headline>
      <Supporting style={styles.supporting}>Here is the whole idea.</Supporting>

      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View key={step.title} style={styles.step}>
            <View style={styles.iconWell}>
              <Ionicons name={step.icon} size={20} color={Theme.colors.secondary} />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{index + 1}</Text>
              </View>
            </View>

            <View style={styles.stepCopy}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDetail}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.stage}>
        <MarshmallowStage
          color={profile.color}
          name={profile.name}
          items={profile.items}
          scale={0.42}
          float
        />
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  supporting: {
    marginTop: 12,
  },
  steps: {
    marginTop: 32,
    gap: 14,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.background,
  },
  /** The order is the point, so each icon carries its place in it. */
  badge: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.secondary,
  },
  badgeText: {
    fontFamily: Theme.fonts.bold,
    fontSize: 11,
    color: Theme.colors.white,
  },
  stepCopy: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 17,
    color: Theme.colors.text,
  },
  stepDetail: {
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: Theme.colors.textSecondary,
  },
  stage: {
    marginTop: 24,
    marginBottom: 8,
  },
});
