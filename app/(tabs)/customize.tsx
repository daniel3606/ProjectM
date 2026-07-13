import React from "react";
import { FlatList, Keyboard, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { GROWTH_STAGES, getStageForSize, type GrowthStage } from "@/constants/growthStages";
import GrowthStagePreviewCard from "@/components/GrowthStagePreviewCard";

// ── Hardcoded — keep in sync with Home for now, later share via context ──
const CURRENT_SIZE_CM = 3;
// ─────────────────────────────────────────────────────────────────────────

const PREVIEW_SIZE_CM = 10;

export default function CustomizeScreen() {
  const insets = useSafeAreaInsets();
  const profile = useMarshmallowProfile();
  const currentStage = getStageForSize(CURRENT_SIZE_CM);

  const renderCard = ({ item }: { item: GrowthStage }) => (
    <GrowthStagePreviewCard
      stage={item}
      isCurrentStage={item.id === currentStage.id}
    />
  );

  return (
    <ScrollView
      style={[styles.screen, { paddingTop: insets.top }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Customize</Text>
      <Text style={styles.subtitle}>Make your marshmallow your own</Text>

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

      <View style={styles.colorGrid}>
        {MARSHMALLOW_COLORS.map((c) => (
          <Pressable
            key={c.hex}
            onPress={() => profile.setColor(c.hex)}
            style={styles.colorOption}
          >
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: c.hex },
                profile.color === c.hex && styles.colorSelected,
              ]}
            >
              {profile.color === c.hex && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.colorLabel}>{c.name}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 16,
  },
  previewWrap: {
    alignItems: "center",
    marginBottom: 8,
  },
  nameInput: {
    marginHorizontal: 24,
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
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
    marginBottom: 24,
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
  sectionTitle: {
    fontSize: 20,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    paddingHorizontal: 24,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    paddingHorizontal: 24,
    marginTop: 4,
    marginBottom: 16,
  },
  stageListContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  footer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.gray,
  },
});
