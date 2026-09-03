import { MarshmallowStage } from "@/components/onboarding";
import { Button, HeroSubtitle, HeroTitle, Screen, SelectableCard } from "@/components/ui";
import {
  PREMIUM_TIMED_BLOCK_LIMIT,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlan,
  type SubscriptionPlanId,
} from "@/constants/subscription";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { HARD_BLOCK_MULTIPLIER } from "@/lib/growthModel";
import { hapticSelection } from "@/lib/haptics";
import {
  formatCentsPerDay,
  formatPlanPrice,
  yearlySavingsPercent,
} from "@/lib/subscriptionPlans";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HARD_BLOCK_GROWTH_PERCENT = Math.round((HARD_BLOCK_MULTIPLIER - 1) * 100);
const YEARLY_OFF_PERCENT = yearlySavingsPercent();

type PremiumFeature = {
  icon: React.ComponentProps<typeof Ionicons>["name"] | "crown";
  label: string;
  highlight: boolean;
  badge?: string;
};

const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    icon: "crown",
    label: "Hard Block",
    highlight: true,
    badge: `${HARD_BLOCK_GROWTH_PERCENT}% faster`,
  },
  {
    icon: "calendar",
    label: `${PREMIUM_TIMED_BLOCK_LIMIT} Scheduled Blocks`,
    highlight: false,
  },
  {
    icon: "stats-chart",
    label: "Month & Year Status Unlocked",
    highlight: false,
  },
  {
    icon: "shield-checkmark",
    label: "Allow Only Blocking",
    highlight: false,
  },
  {
    icon: "color-palette",
    label: "More Customization & Cosmetics",
    highlight: false,
  },
];

/**
 * Deliberately outside onboarding: a new user meets the product and their
 * marshmallow first, and is offered premium later from inside the app.
 */
export default function PremiumScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const profile = useMarshmallowProfile();
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlanId>("yearly");

  const close = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  const selectPlan = useCallback((planId: SubscriptionPlanId) => {
    hapticSelection();
    setSelectedPlanId(planId);
  }, []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "card",
          animation: "default",
        }}
      />

      <Screen style={styles.container} topInset={false}>
        <Pressable
          onPress={close}
          hitSlop={12}
          style={[styles.closeButton, { top: insets.top + 8 }]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Ionicons name="close" size={26} color={Theme.colors.gray} />
        </Pressable>

        <View style={[styles.content, { paddingTop: insets.top + 8 }]}>
          <View style={styles.mascot}>
            <MarshmallowStage
              color={profile.color}
              name={profile.name}
              items={{ headwear: "crown" }}
              isBlocking
              scale={0.4}
            />
          </View>

          <HeroTitle style={styles.title}>
            Unlock the full{"\n"}Marshmallow Experience
          </HeroTitle>
          <HeroSubtitle style={styles.subtitle}>
            Save more time with Marshmallow Premium
          </HeroSubtitle>

          <View style={styles.featureList}>
            {PREMIUM_FEATURES.map((feature) => (
              <View
                key={feature.label}
                style={[styles.featureRow, feature.highlight && styles.featureRowHighlight]}
              >
                <View
                  style={[
                    styles.featureIcon,
                    feature.highlight && styles.featureIconHighlight,
                  ]}
                >
                  {feature.icon === "crown" ? (
                    <MaterialCommunityIcons
                      name="crown"
                      size={16}
                      color={
                        feature.highlight ? Theme.colors.positive : Theme.colors.secondary
                      }
                    />
                  ) : (
                    <Ionicons
                      name={feature.icon}
                      size={16}
                      color={
                        feature.highlight ? Theme.colors.positive : Theme.colors.secondary
                      }
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.featureText,
                    feature.highlight && styles.featureTextHighlight,
                  ]}
                >
                  {feature.label}
                </Text>
                {feature.badge ? (
                  <View style={styles.fasterBadge}>
                    <Text style={styles.fasterBadgeText}>{feature.badge}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          <View style={styles.planList}>
            {SUBSCRIPTION_PLANS.map((plan) => (
              <PlanOption
                key={plan.id}
                plan={plan}
                selected={selectedPlanId === plan.id}
                onPress={() => selectPlan(plan.id)}
              />
            ))}
          </View>
        </View>

        <Button
          label="Start Free Trial"
          onPress={close}
          style={{ marginHorizontal: 32, marginBottom: insets.bottom + 12 }}
        />
      </Screen>
    </>
  );
}

function PlanOption({
  plan,
  selected,
  onPress,
}: {
  plan: SubscriptionPlan;
  selected: boolean;
  onPress: () => void;
}) {
  const isYearly = plan.id === "yearly";

  return (
    <SelectableCard
      selected={selected}
      onPress={onPress}
      style={[styles.planCard, isYearly && styles.planCardYearly]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      testID={`plan-${plan.id}`}
    >
      <View style={styles.planRow}>
        <View
          style={[styles.radio, isYearly && styles.radioYearly, selected && styles.radioSelected]}
        >
          {selected ? (
            <View style={[styles.radioDot, isYearly && styles.radioDotYearly]} />
          ) : null}
        </View>
        <View style={styles.planCopy}>
          <View style={styles.planLabelRow}>
            <Text
              style={[
                styles.planLabel,
                isYearly && styles.planLabelYearly,
                selected && styles.planLabelSelected,
              ]}
            >
              {plan.label}
            </Text>
            {isYearly ? (
              <View style={styles.offBadge}>
                <Text style={styles.offBadgeText}>{YEARLY_OFF_PERCENT}% off</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.planMeta, isYearly && styles.planMetaYearly]}>
            1 month free trial · {formatCentsPerDay(plan)}
          </Text>
        </View>
        <Text
          style={[
            styles.planPrice,
            isYearly && styles.planPriceYearly,
            selected && styles.planPriceSelected,
          ]}
        >
          {formatPlanPrice(plan)}
        </Text>
      </View>
    </SelectableCard>
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
    paddingHorizontal: 32,
  },
  mascot: {
    alignItems: "center",
    // Crown sits above the body; leave room so it isn't clipped.
    paddingTop: 28,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    padding: 10,
    lineHeight: 30,

  },
  subtitle: {
    marginBottom: 12,
    fontSize: 14,
  },
  featureList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 32,
  },
  featureRowHighlight: {
    backgroundColor: Theme.colors.positiveSoft,
    borderRadius: Theme.radius.lg,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  featureIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIconHighlight: {
    backgroundColor: Theme.colors.white,
    borderColor: Theme.colors.positive,
  },
  featureText: {
    flex: 1,
    fontFamily: Theme.fonts.medium,
    fontSize: 15,
    color: Theme.colors.text,
  },
  featureTextHighlight: {
    fontFamily: Theme.fonts.semibold,
  },
  fasterBadge: {
    backgroundColor: Theme.colors.positive,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  fasterBadgeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
    letterSpacing: 0.2,
  },
  planList: {
    marginTop: 18,
    gap: 8,
  },
  planCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  planCardYearly: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  planCopy: {
    flex: 1,
    gap: 2,
  },
  planLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  planLabel: {
    fontFamily: Theme.fonts.semibold,
    fontSize: 14,
    color: Theme.colors.text,
  },
  planLabelYearly: {
    fontSize: 17,
  },
  planLabelSelected: {
    color: Theme.colors.secondary,
  },
  offBadge: {
    backgroundColor: Theme.colors.secondary,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  offBadgeText: {
    fontSize: 13,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.white,
  },
  planPrice: {
    fontFamily: Theme.fonts.bold,
    fontSize: 14,
    color: Theme.colors.text,
    flexShrink: 0,
  },
  planPriceYearly: {
    fontSize: 18,
  },
  planPriceSelected: {
    color: Theme.colors.secondary,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioYearly: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  radioSelected: {
    borderColor: Theme.colors.secondary,
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Theme.colors.secondary,
  },
  radioDotYearly: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  planMeta: {
    fontFamily: Theme.fonts.regular,
    fontSize: 11,
    color: Theme.colors.gray,
  },
  planMetaYearly: {
    fontSize: 13,
  },
});
