/** @jest-environment node */

import { AGE_RANGES } from "@/constants/onboarding";
import {
  computeLifetimeScreenTime,
  computeReclaimedTime,
  describeWeekly,
  describeYearly,
  describeYears,
  formatScreenTime,
  formatYears,
  LIFE_EXPECTANCY_YEARS,
  maxTargetMinutes,
  MAX_SCREEN_TIME_MINUTES,
  MIN_CURRENT_MINUTES,
  MIN_SCREEN_TIME_MINUTES,
  remainingYearsFrom,
  SCREEN_TIME_STEP_MINUTES,
  snapScreenTime,
  suggestTargetMinutes,
} from "@/lib/onboardingTime";

describe("screen time values", () => {
  it("snaps to the step the sliders and haptics use", () => {
    expect(snapScreenTime(187)).toBe(180);
    expect(snapScreenTime(188)).toBe(195);
  });

  it("keeps every value inside the range the sliders can show", () => {
    expect(snapScreenTime(0)).toBe(MIN_SCREEN_TIME_MINUTES);
    expect(snapScreenTime(60 * 40)).toBe(MAX_SCREEN_TIME_MINUTES);
  });

  it("formats durations the way the screens read them out", () => {
    expect(formatScreenTime(380)).toBe("6h 20m");
    expect(formatScreenTime(180)).toBe("3h");
    expect(formatScreenTime(45)).toBe("45m");
  });
});

describe("goal ceiling", () => {
  it("stops one step short of current usage, so a goal always reclaims something", () => {
    expect(maxTargetMinutes(360)).toBe(345);
    expect(computeReclaimedTime(360, maxTargetMinutes(360)).dailyMinutes).toBeGreaterThan(0);
  });

  it("never suggests a goal above the ceiling", () => {
    for (const current of [30, 90, 195, 380, 720]) {
      expect(suggestTargetMinutes(current)).toBeLessThanOrEqual(maxTargetMinutes(current));
    }
  });

  it("leaves something to reclaim at every current usage the flow can produce", () => {
    for (
      let current = MIN_CURRENT_MINUTES;
      current <= MAX_SCREEN_TIME_MINUTES;
      current += SCREEN_TIME_STEP_MINUTES
    ) {
      const worstGoal = maxTargetMinutes(current);
      expect(computeReclaimedTime(current, worstGoal).dailyMinutes).toBeGreaterThan(0);
    }
  });

  it("suggests an ambitious but reachable cut", () => {
    expect(suggestTargetMinutes(380)).toBe(210);
  });
});

describe("reclaimed time", () => {
  it("derives the daily, weekly and yearly figures from the two answers", () => {
    expect(computeReclaimedTime(380, 210)).toEqual({
      dailyMinutes: 170,
      weeklyMinutes: 1190,
      yearlyHours: 1030,
    });
  });

  it("never reports negative time when the goal is above current usage", () => {
    expect(computeReclaimedTime(120, 240).dailyMinutes).toBe(0);
  });

  it("approximates the weekly total the way a person would say it", () => {
    expect(describeWeekly(170)).toBe("Nearly 20 hours every week.");
    expect(describeWeekly(180)).toBe("21 hours every week.");
    expect(describeWeekly(175)).toBe("Over 20 hours every week.");
  });

  it("never rounds a sub-hour week up into an hour it isn't", () => {
    expect(describeWeekly(0)).toBe("0m every week.");
    expect(describeWeekly(5)).toBe("35m every week.");
  });

  it("keeps the yearly figure vague enough to be honest", () => {
    expect(describeYearly(170)).toBe("Around 1,030 hours a year.");
  });
});

describe("lifetime cost", () => {
  it("counts the years left from the middle of the band, not its edges", () => {
    expect(remainingYearsFrom(30)).toBe(LIFE_EXPECTANCY_YEARS - 30);
  });

  it("still offers a horizon to someone past the life expectancy it assumes", () => {
    expect(remainingYearsFrom(95)).toBeGreaterThan(0);
  });

  it("gives every age band a horizon", () => {
    for (const range of AGE_RANGES) {
      expect(remainingYearsFrom(range.midpointAge)).toBeGreaterThan(0);
    }
  });

  it("restates a daily habit as days a year and years of a life", () => {
    // 5h a day for the 50 years a 30-year-old has left.
    const lifetime = computeLifetimeScreenTime(300, 165, 50);
    expect(lifetime.daysPerYear).toBe(76);
    expect(lifetime.yearsLost).toBeCloseTo(10.42, 2);
    expect(lifetime.yearsReclaimed).toBeCloseTo(5.73, 2);
  });

  it("never promises back more life than the habit was costing", () => {
    const lifetime = computeLifetimeScreenTime(120, 600, 50);
    expect(lifetime.yearsReclaimed).toBeCloseTo(lifetime.yearsLost, 5);
  });

  it("has nothing to reclaim for someone who reports no screen time", () => {
    expect(computeLifetimeScreenTime(0, 0, 50)).toEqual({
      daysPerYear: 0,
      remainingYears: 50,
      yearsLost: 0,
      yearsReclaimed: 0,
    });
  });

  it("carries a decimal only while it still means something", () => {
    expect(formatYears(5.73)).toBe("5.7");
    expect(formatYears(6)).toBe("6");
    expect(formatYears(10.42)).toBe("10");
    expect(formatYears(21.6)).toBe("22");
  });

  it("reads the singular out loud correctly", () => {
    expect(describeYears(1)).toBe("1 year");
    expect(describeYears(1.4)).toBe("1.4 years");
    expect(describeYears(12)).toBe("12 years");
  });
});
