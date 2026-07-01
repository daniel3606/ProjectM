import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Theme from "@/constants/theme";
import { GROWTH_STAGES, getStageForSize, type GrowthStage } from "@/constants/growthStages";
import GrowthStagePreviewCard from "@/components/GrowthStagePreviewCard";

// ── Hardcoded — keep in sync with Home for now, later share via context ──
const CURRENT_SIZE_CM = 3;
// ─────────────────────────────────────────────────────────────────────────

export default function SizePreviewScreen() {
  const insets = useSafeAreaInsets();
  const currentStage = getStageForSize(CURRENT_SIZE_CM);

  const renderCard = ({ item }: { item: GrowthStage }) => (
    <GrowthStagePreviewCard
      stage={item}
      isCurrentStage={item.id === currentStage.id}
    />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Size Comparison</Text>
      <Text style={styles.subtitle}>
        See what your marshmallow will be compared to as it grows
      </Text>

      <FlatList
        data={GROWTH_STAGES}
        renderItem={renderCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        snapToInterval={174} // card width (160) + marginRight (14)
        decelerationRate="fast"
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {GROWTH_STAGES.length} stages from {GROWTH_STAGES[0].sizeCm}cm to{" "}
          {GROWTH_STAGES[GROWTH_STAGES.length - 1].sizeCm}cm
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Theme.colors.background,
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
    marginBottom: 20,
  },
  listContent: {
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
