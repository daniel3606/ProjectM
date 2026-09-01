import { Image, type ImageSourcePropType } from "react-native";

/** Comparison object artwork, keyed by `GrowthStage.id`. */
const OBJECT_IMAGES: Record<string, ImageSourcePropType> = {
  blueberry: require("@/assets/images/objects/blueberry_2cm.png"),
  grape: require("@/assets/images/objects/grape_3cm.png"),
  strawberry: require("@/assets/images/objects/strawberry_5cm.png"),
  macaron: require("@/assets/images/objects/Macaron_6cm.png"),
  apple: require("@/assets/images/objects/apple_9cm.png"),
  cupcake: require("@/assets/images/objects/cupcake_11cm.png"),
  boba: require("@/assets/images/objects/Boba_15cm.png"),
  potted_cactus: require("@/assets/images/objects/potted_cactus_18cm.png"),
  basketball: require("@/assets/images/objects/basketball_24cm.png"),
  cat: require("@/assets/images/objects/Cat_30cm.png"),
  yorkshire: require("@/assets/images/objects/Yorkshire_38cm.png"),
  shiba_inu: require("@/assets/images/objects/shiba_inu_45cm.png"),
  suitcase: require("@/assets/images/objects/suitcase_60cm.png"),
  penguin: require("@/assets/images/objects/penguin_80cm.png"),
  flamingo: require("@/assets/images/objects/flamingo_100cm.png"),
  teddybear: require("@/assets/images/objects/teddybear_120cm.png"),
  sunflower: require("@/assets/images/objects/sunflower_150cm.png"),
  person: require("@/assets/images/objects/person_170cm.png"),
  llama: require("@/assets/images/objects/llama_180cm.png"),
  ostrich: require("@/assets/images/objects/Ostrich_200cm.png"),
  christmas_tree: require("@/assets/images/objects/christmas_tree_250cm.png"),
  slide: require("@/assets/images/objects/slide_300cm.png"),
  cherry_blossom_tree: require("@/assets/images/objects/cherry_blossom_tree_400cm.png"),
  giraffe: require("@/assets/images/objects/giraffe_500cm.png"),
  tiny_house: require("@/assets/images/objects/tiny_house_650cm.png"),
  cottage: require("@/assets/images/objects/cottage_800cm.png"),
  house: require("@/assets/images/objects/house_900cm.png"),
};

export function getObjectImage(stageId: string): ImageSourcePropType | undefined {
  return OBJECT_IMAGES[stageId];
}

/**
 * Aspect ratio (width / height) of an object's artwork. The scene compares
 * *heights*, so sprites are laid out from a height and this ratio rather than
 * being fitted into a square box — otherwise a wide asset would render
 * shorter than a narrow one of the same real-world height.
 */
export function getObjectAspectRatio(stageId: string): number {
  const source = OBJECT_IMAGES[stageId];
  if (!source) return 1;
  const resolved = Image.resolveAssetSource(source);
  if (!resolved?.width || !resolved?.height) return 1;
  return resolved.width / resolved.height;
}

export default OBJECT_IMAGES;
