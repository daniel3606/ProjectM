import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import type { GrowthStage } from "@/constants/growthStages";

interface GrowthStagePreviewCardProps {
  stage: GrowthStage;
  isCurrentStage?: boolean;
}

/** Temporary emoji map — will be replaced by real image assets. */
function getPlaceholderEmoji(stageId: string): string {
  const map: Record<string, string> = {
    start: "\uD83C\uDF31",
    grape: "\uD83C\uDF47",
    egg: "\uD83E\uDD5A",
    apple: "\uD83C\uDF4E",
    donut: "\uD83C\uDF69",
    mug: "\u2615",
    banana: "\uD83C\uDF4C",
    teddy_bear: "\uD83E\uDDF8",
    basketball: "\uD83C\uDFC0",
    pillow: "\uD83D\uDECF\uFE0F",
    cat: "\uD83D\uDC31",
    small_dog: "\uD83D\uDC36",
    skateboard: "\uD83D\uDEF9",
    chair: "\uD83E\uDE91",
    human: "\uD83E\uDDCD",
  };
  return map[stageId] ?? "?";
}

export default function GrowthStagePreviewCard({
  stage,
  isCurrentStage = false,
}: GrowthStagePreviewCardProps) {
  return (
    <View style={[styles.card, isCurrentStage && styles.cardActive]}>
      {/* Placeholder visual — swap for real asset later */}
      <View style={styles.visualContainer}>
        <Text style={styles.emoji}>{getPlaceholderEmoji(stage.id)}</Text>
      </View>

      <Text style={styles.objectName}>{stage.objectName}</Text>
      <Text style={styles.sizeBadge}>{stage.sizeCm}cm</Text>
      <Text style={styles.description} numberOfLines={2}>
        {stage.message}
      </Text>

      {isCurrentStage && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>You are here</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 160,
    backgroundColor: Theme.colors.card,
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: Theme.colors.cardBorder,
    marginRight: 14,
  },
  cardActive: {
    borderColor: Theme.colors.secondary,
    borderWidth: 2,
    backgroundColor: "#FFF8F0",
  },
  visualContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "rgba(139,99,92,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  emoji: {
    fontSize: 34,
  },
  objectName: {
    fontSize: 16,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    marginBottom: 2,
  },
  sizeBadge: {
    fontSize: 13,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
    marginBottom: 6,
  },
  description: {
    fontSize: 12,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
  },
  currentBadge: {
    marginTop: 8,
    backgroundColor: Theme.colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  currentBadgeText: {
    fontSize: 11,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});
