import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import type { Recommendation } from "@/lib/stats/types";
import StatsSection from "./StatsSection";

interface RecommendationSectionProps {
  recommendation: Recommendation | null;
  onAction: (recommendation: Recommendation) => void;
}

/** The last thing on the screen, and the only place Stats asks for an action. */
export default function RecommendationSection({
  recommendation,
  onAction,
}: RecommendationSectionProps) {
  const handlePress = useCallback(() => {
    if (recommendation) onAction(recommendation);
  }, [onAction, recommendation]);

  if (!recommendation) return null;

  return (
    <StatsSection title="Try This Next">
      <View style={styles.card} testID="stats-recommendation">
        <Text style={styles.title}>{recommendation.title}</Text>
        <Text style={styles.body}>{recommendation.reason}</Text>
        <Text style={styles.body}>{recommendation.benefit}</Text>

        <Pressable
          onPress={handlePress}
          testID="stats-recommendation-action"
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>{recommendation.action.label}</Text>
          <Ionicons name="arrow-forward" size={16} color={Theme.colors.white} />
        </Pressable>
      </View>
    </StatsSection>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xxl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.sm,
  },
  title: {
    fontSize: 19,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  body: {
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text,
    opacity: 0.75,
  },
  cta: {
    marginTop: Theme.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Theme.colors.secondary,
    borderRadius: Theme.radius.lg,
    paddingVertical: 14,
  },
  ctaPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  ctaLabel: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});
