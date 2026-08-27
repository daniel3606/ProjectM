import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { SelectableCard } from "@/components/ui";
import { hapticSelection } from "@/lib/haptics";

interface OnboardingOptionProps {
  label: string;
  /** Second line, for options that need context (a preset's days and hours). */
  detail?: string;
  selected: boolean;
  onPress: () => void;
  /** Extra content revealed under the label while selected (e.g. a time nudge). */
  children?: React.ReactNode;
}

/**
 * A selectable row. Deliberately not a card grid: the list should read as a
 * list of answers, with the border and tint carrying the selected state.
 */
export default function OnboardingOption({
  label,
  detail,
  selected,
  onPress,
  children,
}: OnboardingOptionProps) {
  const handlePress = useCallback(() => {
    hapticSelection();
    onPress();
  }, [onPress]);

  return (
    <SelectableCard
      selected={selected}
      onPress={handlePress}
      style={styles.row}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.labelRow}>
        <View style={styles.labelText}>
          <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
          {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        </View>

        {selected ? (
          <Ionicons name="checkmark-circle" size={22} color={Theme.colors.secondary} />
        ) : null}
      </View>

      {selected && children ? <View style={styles.expansion}>{children}</View> : null}
    </SelectableCard>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  labelText: {
    flex: 1,
  },
  label: {
    fontFamily: Theme.fonts.medium,
    fontSize: 17,
    color: Theme.colors.text,
  },
  labelSelected: {
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.secondary,
  },
  detail: {
    marginTop: 3,
    fontFamily: Theme.fonts.regular,
    fontSize: 14,
    color: Theme.colors.textSecondary,
  },
  expansion: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.cardBorder,
  },
});
