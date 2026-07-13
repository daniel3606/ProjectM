import React from "react";
import { FlatList, Keyboard, StyleSheet, Text, TextInput, View } from "react-native";
import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import GrowthStagePreviewCard from "@/components/GrowthStagePreviewCard";
import { GROWTH_STAGES, getStageForSize, type GrowthStage } from "@/constants/growthStages";
import { Screen, ScreenTitle, ScreenSubtitle, ColorPicker } from "@/components/ui";

const PREVIEW_SIZE_CM = 10;

// ── Hardcoded — keep in sync with Home for now, later share via context ──
const CURRENT_SIZE_CM = 3;
// ─────────────────────────────────────────────────────────────────────────

export default function CustomizeScreen() {
  const profile = useMarshmallowProfile();
  const currentStage = getStageForSize(CURRENT_SIZE_CM);

  const renderStageCard = ({ item }: { item: GrowthStage }) => (
    <GrowthStagePreviewCard stage={item} isCurrentStage={item.id === currentStage.id} />
  );

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

      <Text style={styles.sectionTitle}>Growth Journey</Text>
      <Text style={styles.sectionSubtitle}>
        Scroll through every stage your marshmallow will reach
      </Text>
      <FlatList
        data={GROWTH_STAGES}
        renderItem={renderStageCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.stageList}
        contentContainerStyle={styles.stageListContent}
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
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  stageList: {
    marginHorizontal: -24,
  },
  stageListContent: {
    paddingHorizontal: 24,
  },
});
