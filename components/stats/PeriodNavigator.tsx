import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Theme from "@/constants/theme";

const ARROW_SIZE = 32;

interface PeriodNavigatorProps {
  /** What the window is called, e.g. "Today" or "25 Aug – 31 Aug". */
  title: string;
  /** True while there is an earlier window worth showing. */
  canGoBack: boolean;
  /** False on the current window — there is nothing ahead of it. */
  canGoForward: boolean;
  onChange: (step: -1 | 1) => void;
}

/**
 * Steps the window the whole screen is about. Sits between the period tabs and
 * the cards, so the tabs choose the size of the window and this chooses which
 * one — the same split as the Screen Time screen it mirrors.
 */
export default function PeriodNavigator({
  title,
  canGoBack,
  canGoForward,
  onChange,
}: PeriodNavigatorProps) {
  return (
    <View style={styles.row}>
      <Arrow
        direction={-1}
        enabled={canGoBack}
        label="Previous period"
        onPress={onChange}
      />

      <Text style={styles.title} numberOfLines={1} testID="stats-period-title">
        {title}
      </Text>

      <Arrow
        direction={1}
        enabled={canGoForward}
        label="Next period"
        onPress={onChange}
      />
    </View>
  );
}

interface ArrowProps {
  direction: -1 | 1;
  enabled: boolean;
  label: string;
  onPress: (step: -1 | 1) => void;
}

const Arrow = React.memo(function Arrow({
  direction,
  enabled,
  label,
  onPress,
}: ArrowProps) {
  const handlePress = useCallback(() => {
    Haptics.selectionAsync();
    onPress(direction);
  }, [onPress, direction]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={!enabled}
      hitSlop={8}
      testID={`stats-period-${direction === -1 ? "back" : "forward"}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      style={({ pressed }) => [
        styles.arrow,
        pressed && styles.arrowPressed,
        !enabled && styles.arrowDisabled,
      ]}
    >
      <Ionicons
        name={direction === -1 ? "chevron-back" : "chevron-forward"}
        size={17}
        color={enabled ? Theme.colors.secondary : Theme.colors.cardBorder}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    letterSpacing: -0.2,
  },
  arrow: {
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    borderRadius: ARROW_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.card,
    borderWidth: 1,
    borderColor: Theme.colors.divider,
  },
  arrowPressed: {
    opacity: 0.6,
  },
  arrowDisabled: {
    // Kept in place rather than hidden, so the title never shifts sideways
    // when the user reaches the current window.
    opacity: 0.45,
  },
});
