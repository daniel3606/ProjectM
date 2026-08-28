import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";
import { Card } from "@/components/ui";
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
 *
 * The row is pressable, the card around it is not, so anything revealed
 * underneath (a time nudge, say) sits beside the touch target rather than
 * inside it.
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
    <Card active={selected} style={styles.card}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
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
      </Pressable>

      {selected && children ? <View style={styles.expansion}>{children}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  pressed: {
    opacity: 0.7,
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
    paddingTop: 14,
    paddingBottom: 16,
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.colors.cardBorder,
  },
});
