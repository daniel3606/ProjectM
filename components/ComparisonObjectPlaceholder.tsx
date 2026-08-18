import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
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

const OBJECT_IMAGES: Record<string, ReturnType<typeof require>> = {
  blueberry:    require("@/assets/images/objects/blueberry.png"),
  grape:        require("@/assets/images/objects/grape.png"),
  strawberry:   require("@/assets/images/objects/strawberry.png"),
  egg:          require("@/assets/images/objects/egg.png"),
  tangerine:    require("@/assets/images/objects/tangerine.png"),
  apple:        require("@/assets/images/objects/apple.png"),
  cupcake:      require("@/assets/images/objects/cupcake.png"),
  donut:        require("@/assets/images/objects/donut.png"),
  hot_beverage: require("@/assets/images/objects/hot_beverage.png"),
  banana:       require("@/assets/images/objects/banana.png"),
  birthday_cake:require("@/assets/images/objects/birthday_cake.png"),
  teddy_bear:   require("@/assets/images/objects/teddy_bear.png"),
  basketball:   require("@/assets/images/objects/basketball.png"),
  sneaker:      require("@/assets/images/objects/sneaker.png"),
  laptop:       require("@/assets/images/objects/laptop.png"),
  cat:          require("@/assets/images/objects/cat.png"),
  dog:          require("@/assets/images/objects/dog.png"),
  skateboard:   require("@/assets/images/objects/skateboard.png"),
  chair:        require("@/assets/images/objects/chair.png"),
  bicycle:      require("@/assets/images/objects/bicycle.png"),
  person:       require("@/assets/images/objects/person.png"),
};

/**
 * Renders a comparison object using an OpenMoji PNG illustration.
 * Sits in the scene background behind the marshmallow.
 */
export default function ComparisonObjectPlaceholder({
  stage,
  scale = 1,
}: ComparisonObjectPlaceholderProps) {
  const BASE_SIZE = 140;
  const clamped = Math.max(0.25, Math.min(scale, 1.8));
  const boxSize = Math.round(BASE_SIZE * clamped);

  const imageSource = OBJECT_IMAGES[stage.id];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{stage.objectName}</Text>
      <Text style={styles.size}>{stage.sizeCm}cm</Text>
      {imageSource ? (
        <Image
          source={imageSource}
          style={{ width: boxSize, height: boxSize }}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.fallback, { width: boxSize, height: boxSize }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
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
  fallback: {
    backgroundColor: Theme.colors.card,
    borderRadius: 4,
  },
});
