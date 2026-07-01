import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Theme from "@/constants/theme";
import type { GrowthStage } from "@/constants/growthStages";

interface ComparisonObjectPlaceholderProps {
  stage: GrowthStage;
  /**
   * Visual scale relative to the marshmallow.
   * 1.0 = same visual height as the marshmallow on screen.
   * Values > 1 make the object larger, < 1 smaller.
   */
  scale?: number;
}

/**
 * Renders a comparison object as a simple emoji + label.
 * Designed to sit in the scene background behind the marshmallow.
 * Replace the emoji with an <Image /> or SVG asset later.
 */
export default function ComparisonObjectPlaceholder({
  stage,
  scale = 1,
}: ComparisonObjectPlaceholderProps) {
  // Must match TARGET_HEIGHT in HomeScreen so scale 1.0 = same height as marshmallow
  const BASE_SIZE = 140;
  const clamped = Math.max(0.25, Math.min(scale, 1.8));
  const boxSize = Math.round(BASE_SIZE * clamped);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{stage.objectName}</Text>
      <Text style={styles.size}>{stage.sizeCm}cm</Text>
      <View style={[styles.box, { width: boxSize, height: boxSize }]} />
    </View>
  );
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

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  box: {
    backgroundColor: "#123456",
    borderRadius: 4,
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontFamily: Theme.fonts.medium,
    color: Theme.colors.secondary,
  },
  size: {
    fontSize: 10,
    fontFamily: Theme.fonts.regular,
    color: Theme.colors.gray,
  },
});
