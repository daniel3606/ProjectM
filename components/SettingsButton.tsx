import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

interface SettingsButtonProps {
  size?: number;
  onPress: () => void;
}

/**
 * Header entry point into Settings. Sits where a profile avatar might
 * otherwise go, but always shows the gear glyph rather than a photo —
 * Settings itself is where the profile preview lives.
 */
export default function SettingsButton({ size = 42, onPress }: SettingsButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      testID="settings-button"
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Ionicons name="settings-outline" size={size * 0.5} color={Theme.colors.secondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: Theme.colors.card,
    borderWidth: 2,
    borderColor: Theme.colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.card,
  },
  pressed: {
    opacity: 0.7,
  },
});
