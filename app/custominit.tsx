import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";


import { View, Text, StyleSheet, Pressable, Keyboard, TouchableWithoutFeedback } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { TextInput } from "react-native-gesture-handler";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];


export default function Custominit() {
  const insets = useSafeAreaInsets();
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
        <View style={[styles.container, { paddingTop: insets.top + 40 }]}>

          <Text style={[styles.title]}>Create Your{"\n"}Marshmallow</Text>
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

                <View style={[styles.colorGrid, {padding: 20}]}>
                {MARSHMALLOW_COLORS.map((c) => (
                  <Pressable
                    key={c.hex}
                    onPress={() => setSelectedColor(c.hex)}
                    style={styles.colorOption}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: c.hex },
                        selectedColor === c.hex && styles.colorSelected,
                      ]}
                    >
                      {selectedColor === c.hex && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </View>
                    <Text style={styles.colorLabel}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            <Pressable
              style={styles.button}
              onPress={() => {
                profile.setName(name.trim() || "Mochi");
                profile.setColor(selectedColor);
                router.push("/onboarding-purpose");
              }}
            >
              <Text style={styles.buttonText}>Next</Text>
            </Pressable>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    paddingHorizontal: 32,
  },
  title:{
    textAlign: "center",
    fontFamily: Theme.fonts.bold,
    fontSize: 32,
    padding: 10,
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 8,
  },
  colorOption: {
    alignItems: "center",
    width: 68,
  },
  colorSwatch: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: Theme.colors.secondary,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: "700",
    color: Theme.colors.secondary,
  },
  colorLabel: {
    marginTop: 6,
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
  button:{
    backgroundColor: Theme.colors.secondary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: Theme.colors.white,
    fontFamily: Theme.fonts.semibold,
    fontSize: 18,
  },
});

