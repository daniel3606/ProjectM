import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import { MARSHMALLOW_COLORS } from "@/constants/marshmallow";
import { ITEM_SLOTS, getItemsForSlot } from "@/constants/items";
import { useMarshmallowProfile } from "@/contexts/MarshmallowProfileContext";
import MarshmallowCharacter from "@/components/MarshmallowCharacter";
import { Screen, ScreenTitle, ColorPicker, ItemPicker } from "@/components/ui";

const PREVIEW_SIZE_CM = 4;

export default function CustomizeScreen() {
  const profile = useMarshmallowProfile();

  return (
    <Screen style={styles.screen}>
      <View style={styles.previewSection}>
        <ScreenTitle style={styles.title}>Customize</ScreenTitle>

        <View style={styles.previewWrap}>
          <MarshmallowCharacter
            color={profile.color}
            name={profile.name}
            sizeCm={PREVIEW_SIZE_CM}
            items={profile.items}
          />
        </View>
      </View>

      <ScrollView
        style={styles.optionsScroll}
        contentContainerStyle={styles.optionsContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Color</Text>
          <ColorPicker
            colors={MARSHMALLOW_COLORS}
            selected={profile.color}
            onSelect={profile.setColor}
            style={styles.colorGrid}
          />
        </View>

        {ITEM_SLOTS.map((slot) => (
          <View key={slot.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{slot.label}</Text>
            <ItemPicker
              items={getItemsForSlot(slot.id)}
              selectedId={profile.items[slot.id]}
              onSelect={(itemId) => profile.toggleItem(slot.id, itemId)}
            />
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  previewSection: {
    paddingHorizontal: Theme.spacing.xxl,
  },
  title: {
    fontSize: 26,
    paddingTop: 16,
  },
  previewWrap: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 32,
  },
  optionsScroll: {
    flex: 1,
  },
  optionsContent: {
    paddingHorizontal: Theme.spacing.xxl,
    paddingTop: Theme.spacing.lg,
    paddingBottom: Theme.spacing.xxxl,
  },
  section: {
    marginBottom: Theme.spacing.xxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Theme.fonts.bold,
    color: Theme.colors.text,
    marginBottom: Theme.spacing.md,
  },
  colorGrid: {
    justifyContent: "flex-start",
  },
});
