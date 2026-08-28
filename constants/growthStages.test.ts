/** @jest-environment node */

import { isObjectRevealed } from "@/constants/growthStages";

describe("isObjectRevealed", () => {
  it("shows every object the marshmallow has reached, plus the next two ahead", () => {
    // Starting size is 2.5cm, between blueberry and grape. Blueberry is
    // already reached; grape and strawberry are the two targets; egg and
    // beyond stay hidden.
    expect(isObjectRevealed(2.5, 2)).toBe(true);
    expect(isObjectRevealed(2.5, 3)).toBe(true);
    expect(isObjectRevealed(2.5, 4)).toBe(true);
    expect(isObjectRevealed(2.5, 5)).toBe(false);
  });

  it("advances the revealed set as soon as the marshmallow passes a stage", () => {
    expect(isObjectRevealed(4.5, 4)).toBe(true);
    expect(isObjectRevealed(4.5, 5)).toBe(true);
    expect(isObjectRevealed(4.5, 6)).toBe(true);
    expect(isObjectRevealed(4.5, 8)).toBe(false);
  });

  it("treats an exact match as reached, so the two ahead sit above it", () => {
    expect(isObjectRevealed(5, 5)).toBe(true);
    expect(isObjectRevealed(5, 6)).toBe(true);
    expect(isObjectRevealed(5, 8)).toBe(true);
    expect(isObjectRevealed(5, 10)).toBe(false);
  });

  it("reveals the first two objects as targets when the marshmallow is still smaller", () => {
    expect(isObjectRevealed(1, 2)).toBe(true);
    expect(isObjectRevealed(1, 3)).toBe(true);
    expect(isObjectRevealed(1, 4)).toBe(false);
  });

  it("reveals everything once the marshmallow has reached the last stage", () => {
    expect(isObjectRevealed(170, 145)).toBe(true);
    expect(isObjectRevealed(170, 170)).toBe(true);
  });
});
