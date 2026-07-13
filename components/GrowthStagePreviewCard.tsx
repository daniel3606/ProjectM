import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import Card from "@/components/ui/Card";
import type { GrowthStage } from "@/constants/growthStages";

interface GrowthStagePreviewCardProps {
  stage: GrowthStage;
  isCurrentStage?: boolean;
}

/** Temporary emoji map — will be replaced by real image assets. */
function getPlaceholderEmoji(stageId: string): string {
  const map: Record<string, string> = {
    blueberry: "\uD83E\uDED0",
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
    <Card active={isCurrentStage} style={styles.card}>
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 132,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    marginRight: 12,
  },
  visualContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(139,99,92,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emoji: {
    fontSize: 26,
  },
  objectName: {
    fontSize: 13,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.text,
    textAlign: "center",
    marginBottom: 2,
  },
  sizeBadge: {
    fontSize: 11,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
    marginBottom: 4,
  },
  description: {
    fontSize: 11,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 14,
  },
  currentBadge: {
    marginTop: 6,
    backgroundColor: Theme.colors.secondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currentBadgeText: {
    fontSize: 10,
    fontFamily: Theme.fonts.semibold,
    color: Theme.colors.white,
  },
});
