export interface GrowthStage {
  id: string;
  sizeCm: number;
  objectName: string;
  message: string;
}

export const GROWTH_STAGES: GrowthStage[] = [
  { id: "blueberry",           sizeCm: 2,   objectName: "Blueberry",           message: "A tiny little start." },
  { id: "grape",               sizeCm: 3,   objectName: "Grape",               message: "Already a little bigger." },
  { id: "strawberry",          sizeCm: 5,   objectName: "Strawberry",          message: "Sweet progress." },
  { id: "macaron",             sizeCm: 6,   objectName: "Macaron",             message: "Small, cute, and growing." },
  { id: "apple",               sizeCm: 9,   objectName: "Apple",               message: "A crisp little milestone." },

  { id: "cupcake",             sizeCm: 11,  objectName: "Cupcake",             message: "A sweet achievement." },
  { id: "boba",                sizeCm: 15,  objectName: "Boba",                message: "Now that's refreshing progress." },
  { id: "potted_cactus",       sizeCm: 18,  objectName: "Potted Cactus",       message: "Standing a little taller." },
  { id: "basketball",          sizeCm: 24,  objectName: "Basketball",          message: "Round and growing strong." },
  { id: "cat",                 sizeCm: 30,  objectName: "Cat",                 message: "You're cat-sized now!" },

  { id: "yorkshire",           sizeCm: 38,  objectName: "Yorkshire",           message: "Yorkshire-sized consistency." },
  { id: "shiba_inu",           sizeCm: 45,  objectName: "Shiba Inu",           message: "A fluffy milestone." },
  { id: "suitcase",            sizeCm: 60,  objectName: "Suitcase",            message: "Packed and ready to grow." },
  { id: "penguin",             sizeCm: 80,  objectName: "Penguin",             message: "You're penguin-sized now!" },
  { id: "flamingo",            sizeCm: 100, objectName: "Flamingo",            message: "Standing tall and proud." },

  { id: "teddybear",           sizeCm: 120, objectName: "Teddy Bear",          message: "That's a giant cuddle." },
  { id: "sunflower",           sizeCm: 150, objectName: "Sunflower",           message: "Reaching for the sun." },
  { id: "person",              sizeCm: 170, objectName: "Person",              message: "You've reached human size!" },
  { id: "llama",               sizeCm: 180, objectName: "Llama",               message: "Llama-sized now!" },
  { id: "ostrich",             sizeCm: 200, objectName: "Ostrich",             message: "That's a tall bird." },

  { id: "christmas_tree",      sizeCm: 250, objectName: "Christmas Tree",      message: "Tree-sized and magical." },
  { id: "slide",               sizeCm: 300, objectName: "Slide",               message: "Welcome to giant territory." },
  { id: "cherry_blossom_tree", sizeCm: 400, objectName: "Cherry Blossom Tree", message: "In full bloom and towering." },
  { id: "giraffe",             sizeCm: 500, objectName: "Giraffe",             message: "That's a seriously tall milestone." },
  { id: "tiny_house",          sizeCm: 650, objectName: "Tiny House",          message: "You're as tall as a tiny house." },

  { id: "cottage",             sizeCm: 800, objectName: "Cottage",             message: "Now that's house-sized growth." },
  { id: "house",               sizeCm: 900, objectName: "House",               message: "You've grown to full house size." },
];

/** Returns the growth stage that matches or is the closest stage at or below the given size. */
export function getStageForSize(sizeCm: number): GrowthStage {
  let matched = GROWTH_STAGES[0];
  for (const stage of GROWTH_STAGES) {
    if (sizeCm >= stage.sizeCm) {
      matched = stage;
    } else {
      break;
    }
  }
  return matched;
}

/** Returns the next stage after the current size, or null if already at max. */
export function getNextStage(sizeCm: number): GrowthStage | null {
  for (const stage of GROWTH_STAGES) {
    if (stage.sizeCm > sizeCm) {
      return stage;
    }
  }
  return null;
}

/**
 * How many unreached stages still show their full-color artwork. Reached
 * objects are always visible; this is the next size sitting in front of the
 * marshmallow. Further objects keep their shape as a black silhouette.
 */
export const REVEALED_AHEAD_COUNT = 1;

/**
 * Whether this object's full-color artwork should be shown rather than a
 * silhouette.
 *
 * Everything the marshmallow has already reached is in color, plus the next
 * {@link REVEALED_AHEAD_COUNT} stage — one target ahead. Beyond that the
 * object is still drawn, but only as a black pit of its real shape.
 */
export function isObjectRevealed(sizeCm: number, objectSizeCm: number): boolean {
  if (objectSizeCm <= sizeCm) return true;

  let ahead = 0;
  for (const stage of GROWTH_STAGES) {
    if (stage.sizeCm <= sizeCm) continue;
    ahead += 1;
    if (stage.sizeCm === objectSizeCm) return ahead <= REVEALED_AHEAD_COUNT;
    if (ahead >= REVEALED_AHEAD_COUNT) return false;
  }
  return false;
}

/** Every growth stage is a comparison object in the world. */
export const OBJECT_STAGES = GROWTH_STAGES;

export interface ComparisonLayout {
  /** Stage further back (second-to-last surpassed), or null. */
  farLeft: GrowthStage | null;
  /** Most recently reached or surpassed stage, or null. */
  left: GrowthStage | null;
  /** Next target stage, or null. */
  right: GrowthStage | null;
}

/**
 * Given the marshmallow's current size, returns up to three comparison
 * objects to display.
 *
 * - "farLeft" is the second-to-last object stage with sizeCm <= currentCm.
 * - "left" is the largest object stage with sizeCm <= currentCm.
 * - "right" is the smallest object stage with sizeCm > currentCm.
 */
export function getComparisonLayout(sizeCm: number): ComparisonLayout {
  let farLeft: GrowthStage | null = null;
  let left: GrowthStage | null = null;
  let right: GrowthStage | null = null;

  for (const stage of OBJECT_STAGES) {
    if (stage.sizeCm <= sizeCm) {
      farLeft = left;
      left = stage;
    }
  }

  for (const stage of OBJECT_STAGES) {
    if (stage.sizeCm > sizeCm) {
      right = stage;
      break;
    }
  }

  return { farLeft, left, right };
}
