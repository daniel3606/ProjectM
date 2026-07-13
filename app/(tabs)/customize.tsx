import React from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";
import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { Screen, ScreenTitle, ScreenSubtitle, ColorPicker } from "@/components/ui";

const PREVIEW_SIZE_CM = 10;

export default function CustomizeScreen() {
  const profile = useMarshmallowProfile();

  return (
    <Screen scroll keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <ScreenTitle style={styles.title}>Customize</ScreenTitle>
      <ScreenSubtitle style={styles.subtitle}>Make your marshmallow your own</ScreenSubtitle>

      <View style={styles.previewWrap}>
        <MarshmallowCharacter
          color={profile.color}
          name={profile.name}
          sizeCm={PREVIEW_SIZE_CM}
        />
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Name your marshmallow"
        placeholderTextColor={Theme.colors.gray}
        value={profile.name}
        onChangeText={profile.setName}
        maxLength={20}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
      />

      <ColorPicker
        colors={MARSHMALLOW_COLORS}
        selected={profile.color}
        onSelect={profile.setColor}
        style={styles.colorGrid}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    paddingTop: 16,
  },
  subtitle: {
    marginBottom: 16,
  },
  previewWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  nameInput: {
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 17,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    textAlign: "center",
    backgroundColor: Theme.colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
  },
  colorGrid: {
    marginBottom: 24,
  },
});
