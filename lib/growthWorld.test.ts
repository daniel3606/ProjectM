/** @jest-environment node */

import { OBJECT_STAGES } from "@/constants/growthStages";
import { INITIAL_MARSHMALLOW_SIZE_CM } from "@/constants/marshmallow";
import { getObjectAspectRatio } from "@/constants/objectImages";
import {
  FOCUS_HEIGHT_PX,
  WORLD_PX_PER_DECADE,
  sizeToWorldX,
  visualScaleForSize,
  worldXToSize,
} from "@/lib/growthWorld";

/** Narrowest phone the scene is designed against (iPhone SE). */
const COMPACT_VIEWPORT_WIDTH_PX = 375;

function naturalGapPx(fromCm: number, toCm: number): number {
  return Math.log10(toCm / fromCm) * WORLD_PX_PER_DECADE;
}

describe("growth world spacing", () => {
  it("starts the marshmallow between blueberry and grape", () => {
    const start = sizeToWorldX(INITIAL_MARSHMALLOW_SIZE_CM);
    expect(start).toBeGreaterThan(sizeToWorldX(2));
    expect(start).toBeLessThan(sizeToWorldX(3));
  });

  it("keeps blueberry and grape on a compact screen at their midpoint", () => {
    const blueberry = sizeToWorldX(2);
    const grape = sizeToWorldX(3);
    const mid = (blueberry + grape) / 2;
    const halfScreen = COMPACT_VIEWPORT_WIDTH_PX / 2;

    expect(Math.abs(blueberry - mid)).toBeLessThan(halfScreen);
    expect(Math.abs(grape - mid)).toBeLessThan(halfScreen);
  });

  it("does not shrink the blueberry–grape gap below the log spacing that fits the screen", () => {
    const gap = sizeToWorldX(3) - sizeToWorldX(2);
    expect(gap).toBeCloseTo(naturalGapPx(2, 3), 5);
  });

  it("never lets consecutive sprites overlap, even when the larger one is scaled up", () => {
    for (let i = 1; i < OBJECT_STAGES.length; i++) {
      const previous = OBJECT_STAGES[i - 1];
      const next = OBJECT_STAGES[i];
      const gap = sizeToWorldX(next.sizeCm) - sizeToWorldX(previous.sizeCm);

      for (const cameraCm of [previous.sizeCm, next.sizeCm]) {
        const prevHalf =
          (FOCUS_HEIGHT_PX *
            getObjectAspectRatio(previous.id) *
            visualScaleForSize(previous.sizeCm, cameraCm)) /
          2;
        const nextHalf =
          (FOCUS_HEIGHT_PX *
            getObjectAspectRatio(next.id) *
            visualScaleForSize(next.sizeCm, cameraCm)) /
          2;

        expect(gap).toBeGreaterThanOrEqual(prevHalf + nextHalf);
      }
    }
  });

  it("opens a tight pair such as egg and tangerine rather than stacking them", () => {
    const natural = naturalGapPx(5, 6);
    const placed = sizeToWorldX(6) - sizeToWorldX(5);
    expect(natural).toBeLessThan(FOCUS_HEIGHT_PX);
    expect(placed).toBeGreaterThan(natural);
    expect(placed).toBeGreaterThanOrEqual(FOCUS_HEIGHT_PX);
  });
});

describe("visual scale", () => {
  it("draws neighbouring objects at their real height ratio", () => {
    // Egg 5cm and tangerine 6cm on screen together at 5.7cm: the tangerine
    // must read as 20% taller, not the compressed ~14% a gamma < 1 produces.
    const egg = visualScaleForSize(5, 5.7);
    const tangerine = visualScaleForSize(6, 5.7);
    expect(tangerine / egg).toBeCloseTo(6 / 5, 5);
  });
});

describe("size ↔ world round-trip", () => {
  it("inverts at every stage and at points between them", () => {
    const samples = [1.8, 2, 2.5, 3, 4, 5, 5.5, 6, 10, 85, 170, 190];
    for (const cm of samples) {
      expect(worldXToSize(sizeToWorldX(cm))).toBeCloseTo(cm, 8);
    }
  });

  it("is strictly increasing with size", () => {
    let previous = sizeToWorldX(1);
    for (const cm of [2, 2.5, 3, 6, 12, 55, 170]) {
      const next = sizeToWorldX(cm);
      expect(next).toBeGreaterThan(previous);
      previous = next;
    }
  });
});
