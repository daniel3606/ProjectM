import React, { useCallback, useState } from "react";
import { Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import {
  Headline,
  MarshmallowStage,
  OnboardingCTA,
  OnboardingLayout,
} from "@/components/onboarding";
import { ColorPicker, ItemPicker } from "@/components/ui";
import { getItemsForSlot } from "@/constants/items";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticSelection } from "@/lib/haptics";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

type MarshmallowColorHex = (typeof MARSHMALLOW_COLORS)[number]["hex"];

const FACE_ITEMS = getItemsForSlot("face");

/**
 * Three choices, no more. The point of this screen is attachment, not
 * configuration — the full customization system lives on the Customize tab.
 */
export default function OnboardingCustomizeStep() {
  const profile = useMarshmallowProfile();
  const { markCustomizationCompleted } = useOnboarding();
  const { progress, goBack, goNext } = useOnboardingStep("customize");

  const [name, setName] = useState("");
  const [pulseToken, setPulseToken] = useState(0);

  const acknowledgeChange = useCallback(() => {
    hapticSelection();
    setPulseToken((token) => token + 1);
  }, []);

  const handleColor = useCallback(
    (hex: MarshmallowColorHex) => {
      if (hex === profile.color) return;
      acknowledgeChange();
      profile.setColor(hex);
    },
    [acknowledgeChange, profile]
  );

  const handleFaceItem = useCallback(
    (itemId: string) => {
      acknowledgeChange();
      profile.toggleItem("face", itemId);
    },
    [acknowledgeChange, profile]
  );

  const handleContinue = useCallback(() => {
    Keyboard.dismiss();
    const trimmed = name.trim();
    if (trimmed.length > 0) profile.setName(trimmed);
    markCustomizationCompleted();
    goNext();
  }, [goNext, markCustomizationCompleted, name, profile]);

  // The name is only committed on Continue, but the character wears it while
  // it's being typed — that response is most of what makes this screen work.
  const previewName = name.trim() || profile.name;

  const equippedFace = profile.items.face;
  const faceCaption =
    FACE_ITEMS.find((item) => item.id === equippedFace)?.name ?? "No accessory";

  return (
    <OnboardingLayout
      progress={progress}
      onBack={goBack}
      scroll
      keyboardAware
      footer={<OnboardingCTA label="Looks Good" onPress={handleContinue} />}
    >
      <Headline style={styles.headline}>Make it yours.</Headline>

      <View style={styles.stage}>
        <MarshmallowStage
          color={profile.color}
          name={previewName}
          items={profile.items}
          scale={0.82}
          pulseToken={pulseToken}
        />
      </View>

      <ColorPicker
        colors={MARSHMALLOW_COLORS}
        selected={profile.color}
        onSelect={handleColor}
        layout="row"
      />

      <View style={styles.accessories}>
        <ItemPicker
          items={FACE_ITEMS}
          selectedId={equippedFace}
          onSelect={handleFaceItem}
        />
        <Text style={styles.caption}>{faceCaption}</Text>
      </View>

      <TextInput
        style={styles.nameInput}
        placeholder="Name your Marshmallow"
        placeholderTextColor={Theme.colors.gray}
        value={name}
        onChangeText={setName}
        maxLength={20}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        autoCorrect={false}
      />
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 20,
  },
  stage: {
    marginTop: 20,
    marginBottom: 28,
  },
  accessories: {
    marginTop: 24,
    alignItems: "center",
  },
  caption: {
    marginTop: 8,
    fontFamily: Theme.fonts.medium,
    fontSize: 13,
    color: Theme.colors.gray,
    textAlign: "center",
  },
  nameInput: {
    marginTop: 28,
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 18,
    backgroundColor: Theme.colors.card,
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    borderColor: Theme.colors.cardBorder,
    fontFamily: Theme.fonts.medium,
    fontSize: 17,
    color: Theme.colors.text,
    textAlign: "center",
  },
});
