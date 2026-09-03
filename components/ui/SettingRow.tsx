import React from "react";
import { Pressable, StyleSheet, Text, View, type ViewStyle, type StyleProp } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

/** The small "PRO" chip that marks a premium-gated control. */
export function ProBadge() {
  return (
    <View style={styles.proBadge}>
      <MaterialCommunityIcons name="crown" size={11} color={Theme.colors.secondary} />
      <Text style={styles.proBadgeText}>PRO</Text>
    </View>
  );
}

interface SettingRowProps {
  title: string;
  /** Second line under the title, e.g. "Can't end this block early". */
  subtitle?: string;
  /** Right-aligned value shown before the chevron, e.g. "5 Apps". */
  value?: string;
  /** Marks the row premium-gated; renders a PRO chip beside the title. */
  pro?: boolean;
  /** Shows a disclosure chevron. Set for rows that open another sheet. */
  chevron?: boolean;
  /** Custom right-hand accessory (a Switch, icon stack, …). */
  accessory?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * One full-width control inside a sheet: title (+ optional PRO chip and
 * subtitle) on the left, a value/accessory and optional chevron on the right.
 * Used for Blocked Apps, Breaks and Hard Mode on the Quick Block sheet.
 */
export default function SettingRow({
  title,
  subtitle,
  value,
  pro,
  chevron,
  accessory,
  onPress,
  disabled,
  style,
  testID,
}: SettingRowProps) {
  const content = (
    <>
      <View style={styles.labels}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {pro && <ProBadge />}
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        {accessory}
        {value ? (
          <Text style={styles.value} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {chevron && (
          <Ionicons name="chevron-forward" size={18} color={Theme.colors.gray} />
        )}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.row, disabled && styles.disabled, style]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Theme.spacing.md,
    backgroundColor: Theme.colors.white,
    borderRadius: Theme.radius.xxl,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    paddingVertical: Theme.spacing.lg,
    paddingHorizontal: Theme.spacing.xl,
    minHeight: 62,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  labels: {
    flexShrink: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
  },
  title: {
    fontSize: 17,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    lineHeight: 17,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.sm,
    flexShrink: 0,
  },
  value: {
    fontSize: 16,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.textSecondary,
    maxWidth: 130,
  },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: Theme.radius.pill,
    borderWidth: 1,
    borderColor: Theme.colors.secondary,
    paddingHorizontal: Theme.spacing.sm,
    paddingVertical: 1,
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.secondary,
    letterSpacing: 0.5,
  },
});
