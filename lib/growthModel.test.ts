import {
  BLOCK_TYPE_MULTIPLIERS,
  GROWTH_TUNING_CONSTANT_K,
  HARD_BLOCK_MULTIPLIER,
  applyDailySoftCap,
  computeRawSessionGrowth,
  computeSessionGrowth,
  getBlockTypeForPlan,
  getQualityMultiplier,
  getRawGrowthToday,
  getStreakDays,
  getStreakMultiplier,
  type GrowthBlockType,
} from "./growthModel";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local noon on the day `offsetDays` from today, so DST never shifts the day. */
function dayAt(offsetDays: number): number {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.getTime() + offsetDays * DAY_MS;
}

describe("multipliers", () => {
  it("prices long blocks down in quality bands", () => {
    expect(getQualityMultiplier(10)).toBe(1.0);
    expect(getQualityMultiplier(120)).toBe(1.0);
    expect(getQualityMultiplier(121)).toBe(0.85);
    expect(getQualityMultiplier(240)).toBe(0.85);
    expect(getQualityMultiplier(241)).toBe(0.65);
    expect(getQualityMultiplier(480)).toBe(0.65);
  });

  it("treats sub-10-minute blocks as full quality, leaving √M to price them", () => {
    expect(getQualityMultiplier(5)).toBe(1.0);
  });

  it("steps the streak multiplier at 7 and 30 days", () => {
    expect(getStreakMultiplier(0)).toBe(1.0);
    expect(getStreakMultiplier(6)).toBe(1.0);
    expect(getStreakMultiplier(7)).toBe(1.05);
    expect(getStreakMultiplier(29)).toBe(1.05);
    expect(getStreakMultiplier(30)).toBe(1.1);
    expect(getStreakMultiplier(365)).toBe(1.1);
  });

  it("ranks block types quick > scheduled > sleep", () => {
    expect(BLOCK_TYPE_MULTIPLIERS.quick).toBeGreaterThan(BLOCK_TYPE_MULTIPLIERS.scheduled);
    expect(BLOCK_TYPE_MULTIPLIERS.scheduled).toBeGreaterThan(BLOCK_TYPE_MULTIPLIERS.sleep);
  });

  it("keeps the Hard Block bonus modest", () => {
    expect(HARD_BLOCK_MULTIPLIER).toBeGreaterThan(1);
    expect(HARD_BLOCK_MULTIPLIER).toBeLessThanOrEqual(1.15);
  });
});

describe("computeRawSessionGrowth", () => {
  const base = { minutes: 60, blockType: "quick" as GrowthBlockType };

  it("follows K × √M × Q × S × B × H", () => {
    expect(computeRawSessionGrowth({ minutes: 100, blockType: "quick" })).toBeCloseTo(
      GROWTH_TUNING_CONSTANT_K * 10,
      10
    );
  });

  it("has diminishing returns in duration", () => {
    const short = computeRawSessionGrowth({ ...base, minutes: 30 });
    const long = computeRawSessionGrowth({ ...base, minutes: 120 });
    // Four times the minutes, less than four times the growth.
    expect(long).toBeGreaterThan(short);
    expect(long).toBeLessThan(short * 4);
  });

  it("awards the Hard Block bonus only on a completed block", () => {
    const normal = computeRawSessionGrowth(base);
    const hard = computeRawSessionGrowth({ ...base, isHardBlock: true });
    expect(hard).toBeCloseTo(normal * HARD_BLOCK_MULTIPLIER, 10);

    expect(computeRawSessionGrowth({ ...base, isHardBlock: true, completed: false })).toBe(0);
    expect(computeRawSessionGrowth({ ...base, completed: false })).toBe(0);
  });

  it("earns nothing for a zero-length block", () => {
    expect(computeRawSessionGrowth({ ...base, minutes: 0 })).toBe(0);
  });
});

describe("applyDailySoftCap", () => {
  it("pays the first 4cm in full, the next 2cm at 60%, the rest at 30%", () => {
    expect(applyDailySoftCap(0)).toBe(0);
    expect(applyDailySoftCap(4)).toBeCloseTo(4, 10);
    expect(applyDailySoftCap(6)).toBeCloseTo(5.2, 10);
    expect(applyDailySoftCap(10)).toBeCloseTo(6.4, 10);
  });

  it("never stops growth, however deep the day runs", () => {
    expect(applyDailySoftCap(100)).toBeGreaterThan(applyDailySoftCap(50));
  });

  it("is order-independent across a day's blocks", () => {
    const blocks = [3, 1.5, 4, 0.8];
    const forward = blocks.reduce(
      (acc, g) => {
        acc.awarded += applyDailySoftCap(acc.raw + g) - applyDailySoftCap(acc.raw);
        acc.raw += g;
        return acc;
      },
      { raw: 0, awarded: 0 }
    );
    const total = blocks.reduce((sum, g) => sum + g, 0);
    expect(forward.awarded).toBeCloseTo(applyDailySoftCap(total), 10);
  });
});

describe("computeSessionGrowth", () => {
  it("keeps raw and awarded growth apart", () => {
    const { rawGrowthCm, awardedGrowthCm } = computeSessionGrowth({
      minutes: 60,
      blockType: "quick",
      rawGrowthTodayCm: 8,
    });
    expect(rawGrowthCm).toBeGreaterThan(awardedGrowthCm);
    expect(awardedGrowthCm).toBeCloseTo(rawGrowthCm * 0.3, 10);
  });

  it("is worth less later in the day than first thing", () => {
    const block = { minutes: 60, blockType: "quick" as GrowthBlockType };
    const morning = computeSessionGrowth({ ...block, rawGrowthTodayCm: 0 });
    const evening = computeSessionGrowth({ ...block, rawGrowthTodayCm: 7 });
    expect(morning.rawGrowthCm).toBeCloseTo(evening.rawGrowthCm, 10);
    expect(evening.awardedGrowthCm).toBeLessThan(morning.awardedGrowthCm);
  });
});

describe("fairness between tiers", () => {
  const block = { minutes: 45, blockType: "quick" as GrowthBlockType, streakDays: 12 };

  it("gives free and Premium users identical growth for an identical normal block", () => {
    // There is no Premium term in the model at all: the only way a Premium
    // account earns more is by completing a Hard Block.
    expect(computeRawSessionGrowth(block)).toBe(computeRawSessionGrowth({ ...block }));
  });

  it("rewards a completed Hard Block by ~10%, and a failed one not at all", () => {
    const normal = computeRawSessionGrowth(block);
    expect(computeRawSessionGrowth({ ...block, isHardBlock: true }) / normal).toBeCloseTo(1.1, 10);
    expect(computeRawSessionGrowth({ ...block, isHardBlock: true, completed: false })).toBe(0);
  });
});

describe("getRawGrowthToday", () => {
  it("sums only today's raw growth", () => {
    const sessions = [
      { completedAt: dayAt(0), rawGrowthCm: 2 },
      { completedAt: dayAt(0), rawGrowthCm: 1.5 },
      { completedAt: dayAt(-1), rawGrowthCm: 9 },
    ];
    expect(getRawGrowthToday(sessions, dayAt(0))).toBeCloseTo(3.5, 10);
  });

  it("counts pre-model sessions as no raw growth rather than guessing", () => {
    expect(getRawGrowthToday([{ completedAt: dayAt(0) }], dayAt(0))).toBe(0);
  });
});

describe("getStreakDays", () => {
  it("counts consecutive days ending yesterday", () => {
    const sessions = [dayAt(-1), dayAt(-2), dayAt(-3)].map((completedAt) => ({ completedAt }));
    expect(getStreakDays(sessions, dayAt(0))).toBe(3);
  });

  it("ignores today, so every block today earns the same streak multiplier", () => {
    const sessions = [{ completedAt: dayAt(0) }, { completedAt: dayAt(-1) }];
    expect(getStreakDays(sessions, dayAt(0))).toBe(1);
  });

  it("breaks on a missed day", () => {
    const sessions = [dayAt(-1), dayAt(-3), dayAt(-4)].map((completedAt) => ({ completedAt }));
    expect(getStreakDays(sessions, dayAt(0))).toBe(1);
  });

  it("is zero with no history", () => {
    expect(getStreakDays([], dayAt(0))).toBe(0);
  });
});

describe("getBlockTypeForPlan", () => {
  it("reads the explicit flag", () => {
    expect(getBlockTypeForPlan({ label: "Work", isSleep: true })).toBe("sleep");
    expect(getBlockTypeForPlan({ label: "Bedtime", isSleep: false })).toBe("scheduled");
  });

  it("falls back to the label for plans saved before the flag", () => {
    expect(getBlockTypeForPlan({ label: "Bedtime" })).toBe("sleep");
    expect(getBlockTypeForPlan({ label: "Sleep" })).toBe("sleep");
    expect(getBlockTypeForPlan({ label: "Study" })).toBe("scheduled");
  });
});
