import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Theme from "@/constants/theme";

interface ProfileAvatarButtonProps {
  imageUri?: string | null;
  size?: number;
  onPress: () => void;
}

export default function ProfileAvatarButton({
  imageUri,
  size = 42,
  onPress,
}: ProfileAvatarButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
    >
      {/* TODO: Replace with Image when user profile images are available */}
      <View
        style={[
          styles.placeholder,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Ionicons
          name="person"
          size={size * 0.5}
          color={Theme.colors.secondary}
        />
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
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.colors.card,
  },
  pressed: {
    opacity: 0.7,
  },
});
