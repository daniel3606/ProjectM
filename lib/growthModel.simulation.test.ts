import {
  INITIAL_MARSHMALLOW_SIZE_CM,
} from "@/constants/marshmallow";
import {
  computeSessionGrowth,
  getStreakMultiplier,
  type GrowthBlockType,
} from "./growthModel";

/**
 * The scenarios `K` was tuned against.
 *
 * These assertions are the tuning itself, not incidental coverage: changing
 * `GROWTH_TUNING_CONSTANT_K` or the soft-cap bands is meant to fail here, and
 * the numbers should only be updated deliberately alongside a retune.
 */

interface Block {
  minutes: number;
  blockType: GrowthBlockType;
  isHardBlock?: boolean;
}

const quick30: Block = { minutes: 30, blockType: "quick" };
const quick60: Block = { minutes: 60, blockType: "quick" };
const hard30: Block = { minutes: 30, blockType: "quick", isHardBlock: true };
const sleep8h: Block = { minutes: 8 * 60, blockType: "sleep" };
const sleep5h: Block = { minutes: 5 * 60, blockType: "sleep" };
const work9h: Block = { minutes: 9 * 60, blockType: "scheduled" };
const scheduled3h: Block = { minutes: 3 * 60, blockType: "scheduled" };

/** Total cm awarded over `days` of the same daily routine, streak included. */
function simulateDays(blocks: readonly Block[], days: number): number {
  let total = 0;

  for (let day = 0; day < days; day++) {
    let rawToday = 0;
    for (const block of blocks) {
      const { rawGrowthCm, awardedGrowthCm } = computeSessionGrowth({
        ...block,
        streakDays: day,
        rawGrowthTodayCm: rawToday,
      });
      rawToday += rawGrowthCm;
      total += awardedGrowthCm;
    }
  }

  return total;
}

function sizeAfterMonth(blocks: readonly Block[]): number {
  return INITIAL_MARSHMALLOW_SIZE_CM + simulateDays(blocks, 30);
}

const SCENARIOS = {
  A: { label: "4 × 30min Quick Blocks", blocks: [quick30, quick30, quick30, quick30] },
  B: {
    label: "4 × 30min Quick Blocks + 8h sleep",
    blocks: [quick30, quick30, quick30, quick30, sleep8h],
  },
  C: { label: "9h scheduled work + 5h sleep", blocks: [work9h, sleep5h] },
  D: { label: "2 × 60min Quick Blocks", blocks: [quick60, quick60] },
  E: { label: "4 × 30min Hard Blocks", blocks: [hard30, hard30, hard30, hard30] },
  F: {
    label: "heavy mixed use",
    blocks: [quick30, quick30, quick60, scheduled3h, hard30, sleep8h],
  },
} as const;

describe("30-day scenarios", () => {
  const sizes = Object.fromEntries(
    Object.entries(SCENARIOS).map(([id, s]) => [id, sizeAfterMonth(s.blocks)])
  ) as Record<keyof typeof SCENARIOS, number>;

  it.each([
    ["A", 180.3],
    ["B", 204.9],
    ["C", 160.5],
    ["D", 157.5],
    ["E", 187.8],
    ["F", 242.2],
  ] as const)("%s reaches the tuned size", (id, expected) => {
    expect(sizes[id]).toBeCloseTo(expected, 1);
  });

  it("puts a realistic active user near 180cm in a month", () => {
    // Scenario A — two hours of deliberate focus a day — is what K is set to.
    expect(sizes.A).toBeGreaterThan(170);
    expect(sizes.A).toBeLessThan(190);
  });

  it("does not let all-day blocking out-earn intentional focus", () => {
    // C blocks 14 hours a day against A's 2, and still finishes behind it.
    expect(sizes.C).toBeLessThan(sizes.A);
  });

  it("gives sleep blocks meaningful but reduced value", () => {
    const sleepOnly = sizeAfterMonth([sleep8h]) - INITIAL_MARSHMALLOW_SIZE_CM;
    const focusOnly = sizeAfterMonth([quick30, quick30, quick30, quick30]) -
      INITIAL_MARSHMALLOW_SIZE_CM;
    expect(sleepOnly).toBeGreaterThan(0.15 * focusOnly);
    expect(sleepOnly).toBeLessThan(0.5 * focusOnly);
  });

  it("keeps the Hard Block edge small over a month", () => {
    // Premium's only growth advantage, and it is bought with commitment.
    expect(sizes.E / sizes.A).toBeGreaterThan(1);
    expect(sizes.E / sizes.A).toBeLessThan(1.1);
  });

  it("rewards a heavy user without letting the day run away", () => {
    expect(sizes.F).toBeGreaterThan(sizes.A);
    expect(sizes.F / sizes.A).toBeLessThan(1.5);
  });
});

describe("streak", () => {
  it("lifts a month only slightly, and only for turning up daily", () => {
    const withStreak = simulateDays([quick30, quick30, quick30, quick30], 30);

    // Same routine from a user who never builds a streak past day 6.
    let flat = 0;
    for (let day = 0; day < 30; day++) {
      let rawToday = 0;
      for (const block of [quick30, quick30, quick30, quick30]) {
        const { rawGrowthCm, awardedGrowthCm } = computeSessionGrowth({
          ...block,
          streakDays: 0,
          rawGrowthTodayCm: rawToday,
        });
        rawToday += rawGrowthCm;
        flat += awardedGrowthCm;
      }
    }

    expect(withStreak).toBeGreaterThan(flat);
    expect(withStreak / flat).toBeLessThan(getStreakMultiplier(30));
  });
});
