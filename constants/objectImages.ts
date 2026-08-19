import { Image, type ImageSourcePropType } from "react-native";

/** Comparison object artwork, keyed by `GrowthStage.id`. */
const OBJECT_IMAGES: Record<string, ImageSourcePropType> = {
  blueberry: require("@/assets/images/objects/blueberry.png"),
  grape: require("@/assets/images/objects/grape.png"),
  strawberry: require("@/assets/images/objects/strawberry.png"),
  egg: require("@/assets/images/objects/egg.png"),
  tangerine: require("@/assets/images/objects/tangerine.png"),
  apple: require("@/assets/images/objects/apple.png"),
  cupcake: require("@/assets/images/objects/cupcake.png"),
  donut: require("@/assets/images/objects/donut.png"),
  hot_beverage: require("@/assets/images/objects/hot_beverage.png"),
  banana: require("@/assets/images/objects/banana.png"),
  birthday_cake: require("@/assets/images/objects/birthday_cake.png"),
  teddy_bear: require("@/assets/images/objects/teddy_bear.png"),
  basketball: require("@/assets/images/objects/basketball.png"),
  sneaker: require("@/assets/images/objects/sneaker.png"),
  laptop: require("@/assets/images/objects/laptop.png"),
  cat: require("@/assets/images/objects/cat.png"),
  dog: require("@/assets/images/objects/dog.png"),
  skateboard: require("@/assets/images/objects/skateboard.png"),
  chair: require("@/assets/images/objects/chair.png"),
  bicycle: require("@/assets/images/objects/bicycle.png"),
  person: require("@/assets/images/objects/person.png"),
};

export function getObjectImage(stageId: string): ImageSourcePropType | undefined {
  return OBJECT_IMAGES[stageId];
}

/**
 * Aspect ratio (width / height) of an object's artwork. The scene compares
 * *heights*, so sprites are laid out from a height and this ratio rather than
 * being fitted into a square box — otherwise a wide asset like the bicycle
 * would render shorter than a narrow one of the same real-world height.
 */
export function getObjectAspectRatio(stageId: string): number {
  const source = OBJECT_IMAGES[stageId];
  if (!source) return 1;
  const resolved = Image.resolveAssetSource(source);
  if (!resolved?.width || !resolved?.height) return 1;
  return resolved.width / resolved.height;
}

export default OBJECT_IMAGES;
