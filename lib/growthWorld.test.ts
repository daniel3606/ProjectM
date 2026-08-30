/** @jest-environment node */

import { OBJECT_STAGES } from "@/constants/growthStages";
import { INITIAL_MARSHMALLOW_SIZE_CM } from "@/constants/marshmallow";
import { getObjectAspectRatio } from "@/constants/objectImages";
import {
  FOCUS_HEIGHT_PX,
  MIN_PINNED_SCALE,
  WORLD_PX_PER_DECADE,
  pinProgress,
  pinnedOffsetPx,
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

describe("marshmallow pin", () => {
  /** Offsets the marshmallow reaches when the camera scrubs up to bigger objects. */
  const upwardDrifts = [-1, -20, -116, -400, -2000, -20000];

  it("leaves the drift toward smaller objects alone", () => {
    for (const drift of [0, 1, 40, 300, 5000]) {
      expect(pinnedOffsetPx(drift)).toBe(drift);
      expect(pinProgress(drift)).toBe(0);
    }
  });

  it("holds the middle of the scene however far the camera runs", () => {
    for (const drift of upwardDrifts) {
      expect(pinnedOffsetPx(drift)).toBe(0);
    }
  });

  it("rises into the comparison pose rather than jumping into it", () => {
    // The lift is what the pin actually animates, so it has to ease in: a step
    // would snap the marshmallow up to the object ground line.
    expect(pinProgress(-1)).toBeLessThan(0.05);
    expect(pinProgress(-116)).toBeGreaterThan(0.5);
    expect(pinProgress(-20000)).toBeCloseTo(1, 5);

    let previous = 0;
    for (const drift of upwardDrifts) {
      const progress = pinProgress(drift);
      expect(progress).toBeGreaterThan(previous);
      previous = progress;
    }
  });

  it("draws the pinned marshmallow at its true ratio against the object in focus", () => {
    // A 10cm marshmallow beside a 22cm cake reads as under half its height,
    // which the object floor would have flattened to a quarter.
    expect(visualScaleForSize(10, 22, MIN_PINNED_SCALE)).toBeCloseTo(10 / 22, 5);
    expect(visualScaleForSize(4, 45, MIN_PINNED_SCALE)).toBeCloseTo(4 / 45, 5);
  });

  it("keeps the pinned marshmallow visible against the largest objects", () => {
    const scale = visualScaleForSize(2, 170, MIN_PINNED_SCALE);
    expect(scale).toBe(MIN_PINNED_SCALE);
    expect(FOCUS_HEIGHT_PX * scale).toBeGreaterThanOrEqual(8);
  });
});
