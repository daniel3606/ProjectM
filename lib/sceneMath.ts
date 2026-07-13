import type { GrowthStage } from "@/constants/growthStages";

/** Horizontal distance in pixels between two neighboring object slots. */
export const OBJECT_GAP = 220;

const MIN_OBJECT_SCALE = 0.25;
const MAX_OBJECT_SCALE = 1.8;

/**
 * Comparison objects live at fixed "world" positions along a single line
 * (`index * OBJECT_GAP`). The camera slides along that line so the object
 * matching the marshmallow's current size sits centered on screen. Between
 * two stage sizes the camera position is linearly interpolated between
 * their slots, which is what makes the scene feel like it's panning rather
 * than cutting between objects.
 */
export function getCameraPosition(sizeCm: number, stages: GrowthStage[]): number {
  if (stages.length === 0) return 0;

  const lastIndex = stages.length - 1;
  if (sizeCm <= stages[0].sizeCm) return 0;
  if (sizeCm >= stages[lastIndex].sizeCm) return lastIndex * OBJECT_GAP;

  for (let index = 0; index < lastIndex; index++) {
    const lowerStage = stages[index];
    const upperStage = stages[index + 1];
    if (sizeCm <= upperStage.sizeCm) {
      const progressToNextStage =
        (sizeCm - lowerStage.sizeCm) / (upperStage.sizeCm - lowerStage.sizeCm);
      return (index + progressToNextStage) * OBJECT_GAP;
    }
  }

  return lastIndex * OBJECT_GAP;
}

/** Index of the stage whose slot is currently nearest the center of the screen. */
export function getFocusedStageIndex(sizeCm: number, stages: GrowthStage[]): number {
  if (stages.length === 0) return 0;

  const cameraPosition = getCameraPosition(sizeCm, stages);
  const nearestIndex = Math.round(cameraPosition / OBJECT_GAP);
  return Math.min(Math.max(nearestIndex, 0), stages.length - 1);
}

/** Visual scale of a comparison object relative to the marshmallow, clamped to stay legible. */
export function getObjectScale(stageSizeCm: number, currentSizeCm: number): number {
  if (currentSizeCm <= 0) return MAX_OBJECT_SCALE;

  const rawScale = stageSizeCm / currentSizeCm;
  return Math.min(Math.max(rawScale, MIN_OBJECT_SCALE), MAX_OBJECT_SCALE);
}
