import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

interface StatsSectionProps {
  title: string;
  /** Optional trailing link, e.g. "See all". */
  actionLabel?: string;
  onActionPress?: () => void;
  /** Small line under the title, for a total or a period qualifier. */
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** Title, optional trailing link, and the rhythm every Stats section shares. */
export default function StatsSection({
  title,
  actionLabel,
  onActionPress,
  subtitle,
  style,
  children,
}: StatsSectionProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <View style={styles.headings}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {actionLabel && onActionPress ? (
          <Pressable
            onPress={onActionPress}
            hitSlop={10}
            testID={`stats-section-action-${title}`}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text style={styles.actionLabel}>{actionLabel}</Text>
            <Ionicons
              name="chevron-forward"
              size={13}
              color={Theme.colors.secondary}
            />
          </Pressable>
        ) : null}
      </View>

      {children}
    </View>
  );
}

/** One sentence explaining the numbers above it. Every chart gets one. */
export function Interpretation({ children }: { children: React.ReactNode }) {
  return <Text style={styles.interpretation}>{children}</Text>;
}

const styles = StyleSheet.create({
  section: {
    marginTop: 36,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Theme.spacing.lg,
  },
  headings: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingLeft: Theme.spacing.md,
  },
  actionPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    fontSize: 14,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },
  interpretation: {
    marginTop: Theme.spacing.lg,
    fontSize: 14.5,
    lineHeight: 21,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.text,
    opacity: 0.75,
  },
});
