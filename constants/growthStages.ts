export interface GrowthStage {
  id: string;
  sizeCm: number;
  objectName: string;
  message: string;
}

export const GROWTH_STAGES: GrowthStage[] = [
  { id: "start", sizeCm: 3, objectName: "Start", message: "Your marshmallow journey begins." },
  { id: "grape", sizeCm: 4, objectName: "Grape", message: "Tiny but already growing." },
  { id: "egg", sizeCm: 6, objectName: "Egg", message: "Egg-sized focus energy." },
  { id: "apple", sizeCm: 8, objectName: "Apple", message: "Crisp progress." },
  { id: "donut", sizeCm: 10, objectName: "Donut", message: "Almost donut-sized. Keep going!" },
  { id: "mug", sizeCm: 12, objectName: "Mug", message: "A cozy mug-sized marshmallow." },
  { id: "banana", sizeCm: 15, objectName: "Banana", message: "Long focus streaks are paying off." },
  { id: "teddy_bear", sizeCm: 20, objectName: "Teddy Bear", message: "Soft, strong, and growing." },
  { id: "basketball", sizeCm: 24, objectName: "Basketball", message: "Now that is a round achievement." },
  { id: "pillow", sizeCm: 30, objectName: "Pillow", message: "Big enough to hug." },
  { id: "cat", sizeCm: 45, objectName: "Cat", message: "Cat-sized discipline." },
  { id: "small_dog", sizeCm: 60, objectName: "Small Dog", message: "Your marshmallow has real presence now." },
  { id: "skateboard", sizeCm: 80, objectName: "Skateboard", message: "Rolling into serious growth." },
  { id: "chair", sizeCm: 120, objectName: "Chair", message: "Almost human scale." },
  { id: "human", sizeCm: 170, objectName: "Human", message: "Your marshmallow reached human size." },
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

/** Object stages only (excludes "start" which has no comparison object). */
export const OBJECT_STAGES = GROWTH_STAGES.filter((s) => s.id !== "start");

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
