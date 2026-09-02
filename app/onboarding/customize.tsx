import React, { useCallback, useState } from "react";
import { Keyboard, StyleSheet, TextInput, View } from "react-native";
import {
  Headline,
  MarshmallowStage,
  OnboardingCTA,
  OnboardingLayout,
} from "@/components/onboarding";
import { ColorPicker } from "@/components/ui";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import Theme from "@/constants/theme";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { hapticSelection } from "@/lib/haptics";
import { useOnboardingStep } from "@/lib/useOnboardingStep";

/**
 * A colour and a name, no more. The point of this screen is attachment, not
 * configuration. Only the fixed palette is offered here: the custom colour is
 * premium, and onboarding is the wrong place to meet a paywall.
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
    (hex: string) => {
      if (hex === profile.color) return;
      acknowledgeChange();
      profile.setColor(hex);
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
          name={profile.name}
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
  nameInput: {
    marginTop: 32,
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
