import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface EmptyStateProps {
  title: string;
  body: string;
  icon?: IoniconName;
  /** Tightens the block for use inside a small section. */
  compact?: boolean;
}

/**
 * Stands in for a section with nothing real to show. Carries no chart,
 * placeholder bars or sample numbers, so no invented data reaches the screen.
 */
export default function EmptyState({ title, body, icon, compact }: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      {icon ? (
        <Ionicons name={icon} size={18} color={Theme.colors.secondaryLight} />
      ) : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.xl,
    gap: Theme.spacing.xs,
  },
  compact: {
    paddingVertical: Theme.spacing.lg,
  },
  title: {
    fontSize: 15,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
  },
});
