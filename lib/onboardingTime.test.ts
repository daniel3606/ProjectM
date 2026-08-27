/** @jest-environment node */

import {
  computeReclaimedTime,
  describeWeekly,
  describeYearly,
  formatScreenTime,
  maxTargetMinutes,
  MAX_SCREEN_TIME_MINUTES,
  MIN_SCREEN_TIME_MINUTES,
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

  it("keeps the yearly figure vague enough to be honest", () => {
    expect(describeYearly(170)).toBe("Around 1,030 hours a year.");
  });
});
