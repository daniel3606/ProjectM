import React from "react";
import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import Theme from "@/constants/theme";

interface CardProps extends ViewProps {
  /** Use the elevated white tone (for cards nested inside a colored sheet/card). */
  tone?: "default" | "surface";
  /** Highlights the card as the active/selected one. */
  active?: boolean;
}

/** Static bordered container matching the app's card look (used for info/summary blocks). */
export default function Card({ tone = "default", active, style, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        tone === "surface" && styles.surface,
        active && styles.active,
        style,
      ]}
      {...props}
    />
  );
}

interface SelectableCardProps extends Omit<ViewProps, "style"> {
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: "default" | "surface";
  style?: ViewProps["style"];
}

/** Pressable version of Card with selected/pressed/disabled states baked in. */
export function SelectableCard({
  selected,
  disabled,
  onPress,
  onLongPress,
  tone = "default",
  style,
  ...props
}: SelectableCardProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        styles.selectable,
        tone === "surface" && styles.surface,
        selected && styles.active,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  surface: {
    backgroundColor: Theme.colors.white,
  },
  selectable: {
    borderWidth: 1.5,
  },
  active: {
    borderColor: Theme.colors.secondary,
    borderWidth: 2,
    backgroundColor: Theme.colors.cardActiveTint,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
