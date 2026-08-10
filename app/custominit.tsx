import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Screen, HeroTitle, ColorPicker, Button } from "@/components/ui";

import { StyleSheet, Keyboard, Text, TouchableWithoutFeedback } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { TextInput } from "react-native-gesture-handler";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

export default function Custominit() {
  const router = useRouter();
  const profile = useMarshmallowProfile();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [selectedColor, setSelectedColor] = useState<MarshmallowColorHex>(
    MARSHMALLOW_COLORS[0].hex
  );

  const onNext = async () => {
    profile.setName(name.trim() || "Mochi");
    profile.setColor(selectedColor);

    // Set username for authenticated users
    if (user && username.trim().length >= 3) {
      const { error } = await supabase
        .from("profiles")
        .update({ username: username.trim().toLowerCase() })
        .eq("id", user.id);

      if (error) {
        if (error.code === "23505") {
          setUsernameError("Username already taken");
        } else {
          setUsernameError(error.message);
        }
        return;
      }
    }

    router.push("/onboarding-purpose");
  };

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
        <Screen
          scroll
          topInset={24}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <HeroTitle style={styles.title}>Create Your{"\n"}Marshmallow</HeroTitle>
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
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />

          {user && (
            <>
              <TextInput
                style={styles.textInput}
                placeholder="Choose a username"
                placeholderTextColor={Theme.colors.gray}
                value={username}
                onChangeText={(text) => {
                  setUsername(text.replace(/[^a-zA-Z0-9_]/g, ""));
                  setUsernameError("");
                }}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
              {usernameError ? (
                <Text style={styles.error}>{usernameError}</Text>
              ) : (
                <Text style={styles.hint}>
                  Friends can find you by username
                </Text>
              )}
            </>
          )}

          <ColorPicker
            colors={MARSHMALLOW_COLORS}
            selected={selectedColor}
            onSelect={setSelectedColor}
            layout="row"
            style={styles.colorRow}
          />

          <Button
            label="Next"
            style={styles.button}
            onPress={onNext}
          />
        </Screen>
      </TouchableWithoutFeedback>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 32,
  },
  title: {
    padding: 0,
    marginBottom: 8,
  },
  textInput: {
    width: "100%",
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 20,
    fontSize: 20,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.text,
    textAlign: "center",
  },
  error: {
    color: Theme.colors.danger,
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    textAlign: "center",
    marginBottom: 4,
  },
  hint: {
    color: Theme.colors.gray,
    fontSize: 13,
    fontFamily: Theme.fonts.regular,
    textAlign: "center",
    marginBottom: 4,
  },
  colorRow: {
    marginBottom: 24,
  },
  button: {
    marginTop: "auto",
  },
});
