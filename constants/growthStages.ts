export interface GrowthStage {
  id: string;
  sizeCm: number;
  objectName: string;
  message: string;
}

export const GROWTH_STAGES: GrowthStage[] = [
  { id: "blueberry",    sizeCm: 2,   objectName: "Blueberry",     message: "Small and sweet — your very first step." },
  { id: "grape",        sizeCm: 3,   objectName: "Grape",          message: "Tiny but already growing." },
  { id: "strawberry",   sizeCm: 4,   objectName: "Strawberry",     message: "Sweet progress." },
  { id: "egg",          sizeCm: 5,   objectName: "Egg",            message: "Egg-sized focus energy." },
  { id: "tangerine",    sizeCm: 6,   objectName: "Tangerine",      message: "Zesty consistency." },
  { id: "apple",        sizeCm: 8,   objectName: "Apple",          message: "Crisp progress." },
  { id: "cupcake",      sizeCm: 10,  objectName: "Cupcake",        message: "Sweet milestone!" },
  { id: "donut",        sizeCm: 12,  objectName: "Donut",          message: "Keep the momentum rolling!" },
  { id: "hot_beverage", sizeCm: 14,  objectName: "Hot Beverage",   message: "A cozy, warm milestone." },
  { id: "banana",       sizeCm: 17,  objectName: "Banana",         message: "Long focus streaks are paying off." },
  { id: "birthday_cake",sizeCm: 22,  objectName: "Birthday Cake",  message: "This is worth celebrating." },
  { id: "teddy_bear",   sizeCm: 28,  objectName: "Teddy Bear",     message: "Soft, strong, and growing." },
  { id: "basketball",   sizeCm: 35,  objectName: "Basketball",     message: "Now that is a round achievement." },
  { id: "sneaker",      sizeCm: 45,  objectName: "Sneaker",        message: "Keep running toward your goals." },
  { id: "laptop",       sizeCm: 55,  objectName: "Laptop",         message: "Your focus could power a whole screen." },
  { id: "cat",          sizeCm: 70,  objectName: "Cat",            message: "Cat-sized discipline." },
  { id: "dog",          sizeCm: 85,  objectName: "Dog",            message: "Your marshmallow has real presence now." },
  { id: "skateboard",   sizeCm: 100, objectName: "Skateboard",     message: "Rolling into serious growth." },
  { id: "chair",        sizeCm: 120, objectName: "Chair",          message: "Almost human scale." },
  { id: "bicycle",      sizeCm: 145, objectName: "Bicycle",        message: "You are really going places." },
  { id: "person",       sizeCm: 170, objectName: "Person",         message: "Your marshmallow reached human size." },
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
 * How many unreached stages still show their artwork. Reached objects are
 * always visible; this is the window of targets sitting in front of the
 * marshmallow so the next couple of sizes are real rather than a mystery box.
 */
export const REVEALED_AHEAD_COUNT = 2;

/**
 * Whether this object's artwork should be shown rather than a placeholder.
 *
 * Everything the marshmallow has already reached is visible, plus the next
 * {@link REVEALED_AHEAD_COUNT} stages — two targets ahead, and nothing
 * beyond that spoils the surprise.
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

/** All stages have a comparison object image. */
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
