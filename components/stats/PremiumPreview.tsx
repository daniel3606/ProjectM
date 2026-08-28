import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

interface PremiumPreviewProps {
  title: string;
  /** What the locked content would tell the user, in their terms. */
  teaser: string;
  /** The single CTA for this viewport. Omit on secondary previews. */
  ctaLabel?: string;
  onPressCta?: () => void;
  testID?: string;
}

/**
 * The locked state for premium content: the value is stated plainly, the
 * badge is small, and there is no blur or lock wall. Only one of these on a
 * screen should carry a CTA.
 */
export default function PremiumPreview({
  title,
  teaser,
  ctaLabel,
  onPressCta,
  testID,
}: PremiumPreviewProps) {
  const handlePress = useCallback(() => onPressCta?.(), [onPressCta]);

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.headingRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>Premium</Text>
        </View>
      </View>

      <Text style={styles.teaser}>{teaser}</Text>

      {ctaLabel && onPressCta ? (
        <Pressable
          onPress={handlePress}
          testID="stats-premium-cta"
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={15} color={Theme.colors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    padding: Theme.spacing.xl,
    gap: Theme.spacing.xs,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  badge: {
    backgroundColor: Theme.colors.background,
    borderRadius: Theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeLabel: {
    fontSize: 11,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
    letterSpacing: 0.2,
  },
  teaser: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  cta: {
    marginTop: Theme.spacing.md,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Theme.colors.secondary,
    borderRadius: Theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaLabel: {
    fontSize: 14.5,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});
