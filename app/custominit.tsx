import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { Screen, HeroTitle, ColorPicker, Button } from "@/components/ui";

import { StyleSheet, Keyboard, TouchableWithoutFeedback } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { TextInput } from "react-native-gesture-handler";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

export default function Custominit() {
  const router = useRouter();
  const profile = useMarshmallowProfile();

  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState<MarshmallowColorHex>(
    MARSHMALLOW_COLORS[0].hex
  );
  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: "fullScreenModal",
          animation: "slide_from_bottom",
        }}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <Screen topInset={40} style={styles.container}>
          <HeroTitle>Create Your{"\n"}Marshmallow</HeroTitle>
          <MarshmallowCharacter
            color={selectedColor}
            name={name.trim()}
            sizeCm={1}
          />

          <TextInput
            style={styles.textInput}
            placeholder="Name your marshmallow"
            placeholderTextColor={Theme.colors.gray}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          <ColorPicker
            colors={MARSHMALLOW_COLORS}
            selected={selectedColor}
            onSelect={setSelectedColor}
            style={styles.colorGrid}
          />

          <Button
            label="Next"
            onPress={() => {
              profile.setName(name.trim() || "Mochi");
              profile.setColor(selectedColor);
              router.push("/onboarding-purpose");
            }}
          />
        </Screen>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 32,
  },
  textInput: {
    width: "100%",
    marginBottom: 18,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 22,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    textAlign: "center",
  },
  colorGrid: {
    padding: 20,
  },
});

