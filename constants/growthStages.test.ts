/** @jest-environment node */

import {
  GROWTH_STAGES,
  isObjectRevealed,
} from "@/constants/growthStages";
import { getObjectImage } from "@/constants/objectImages";

function stageSizeCm(id: string): number {
  const stage = GROWTH_STAGES.find((candidate) => candidate.id === id);
  if (!stage) {
    throw new Error(`Unknown growth stage: ${id}`);
  }
  return stage.sizeCm;
}

describe("growth stages", () => {
  it("lists every milestone in strictly increasing size so the world can walk them in order", () => {
    for (let index = 1; index < GROWTH_STAGES.length; index++) {
      expect(GROWTH_STAGES[index].sizeCm).toBeGreaterThan(
        GROWTH_STAGES[index - 1].sizeCm,
      );
    }
  });

  it("has artwork for every milestone so a reached object is never a silhouette", () => {
    for (const stage of GROWTH_STAGES) {
      expect(getObjectImage(stage.id)).toBeDefined();
    }
  });
});

describe("isObjectRevealed", () => {
  it("shows every object the marshmallow has reached, plus the next one ahead", () => {
    // Starting size is 2.5cm, between blueberry and grape. Blueberry is
    // already reached; grape is the one target; strawberry and beyond stay
    // silhouettes.
    expect(isObjectRevealed(2.5, stageSizeCm("blueberry"))).toBe(true);
    expect(isObjectRevealed(2.5, stageSizeCm("grape"))).toBe(true);
    expect(isObjectRevealed(2.5, stageSizeCm("strawberry"))).toBe(false);
    expect(isObjectRevealed(2.5, stageSizeCm("macaron"))).toBe(false);
  });

  it("advances the revealed set as soon as the marshmallow passes a stage", () => {
    const pastStrawberryCm = 5.5;
    expect(isObjectRevealed(pastStrawberryCm, stageSizeCm("strawberry"))).toBe(
      true,
    );
    expect(isObjectRevealed(pastStrawberryCm, stageSizeCm("macaron"))).toBe(
      true,
    );
    expect(isObjectRevealed(pastStrawberryCm, stageSizeCm("apple"))).toBe(
      false,
    );
    expect(isObjectRevealed(pastStrawberryCm, stageSizeCm("cupcake"))).toBe(
      false,
    );
  });

  it("treats an exact match as reached, so the one ahead sits above it", () => {
    const strawberryCm = stageSizeCm("strawberry");
    expect(isObjectRevealed(strawberryCm, strawberryCm)).toBe(true);
    expect(isObjectRevealed(strawberryCm, stageSizeCm("macaron"))).toBe(true);
    expect(isObjectRevealed(strawberryCm, stageSizeCm("apple"))).toBe(false);
    expect(isObjectRevealed(strawberryCm, stageSizeCm("cupcake"))).toBe(false);
  });

  it("reveals the first object as a target when the marshmallow is still smaller", () => {
    expect(isObjectRevealed(1, stageSizeCm("blueberry"))).toBe(true);
    expect(isObjectRevealed(1, stageSizeCm("grape"))).toBe(false);
    expect(isObjectRevealed(1, stageSizeCm("strawberry"))).toBe(false);
  });

  it("reveals everything once the marshmallow has reached the last stage", () => {
    const houseCm = stageSizeCm("house");
    expect(isObjectRevealed(houseCm, stageSizeCm("cottage"))).toBe(true);
    expect(isObjectRevealed(houseCm, houseCm)).toBe(true);
  });
});
