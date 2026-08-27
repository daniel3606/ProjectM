/** @jest-environment node */

import { findSchedulePreset, SCHEDULE_SHIFT_LIMIT_MINUTES } from "@/constants/onboarding";
import {
  clampScheduleShift,
  describeDays,
  describePresetWindow,
  planFromPreset,
} from "@/lib/onboardingSchedule";
import type { ScreenTimeItem } from "@/modules/screen-time";

const study = findSchedulePreset("study")!;
const bedtime = findSchedulePreset("bedtime")!;

describe("preset descriptions", () => {
  it("names the days the shortest true way", () => {
    expect(describeDays([1, 2, 3, 4, 5])).toBe("Weekdays");
    expect(describeDays([0, 1, 2, 3, 4, 5, 6])).toBe("Every day");
    expect(describeDays([1, 3])).toBe("Mon, Wed");
  });

  it("shows the window, shifted", () => {
    expect(describePresetWindow(study)).toBe("7:00 PM – 10:00 PM");
    expect(describePresetWindow(study, -60)).toBe("6:00 PM – 9:00 PM");
  });

  it("wraps windows that run past midnight", () => {
    expect(describePresetWindow(bedtime)).toBe("11:00 PM – 7:00 AM");
  });
});

describe("nudging a preset", () => {
  it("holds the shift inside the allowed range", () => {
    expect(clampScheduleShift(SCHEDULE_SHIFT_LIMIT_MINUTES + 30)).toBe(
      SCHEDULE_SHIFT_LIMIT_MINUTES
    );
    expect(clampScheduleShift(-SCHEDULE_SHIFT_LIMIT_MINUTES - 30)).toBe(
      -SCHEDULE_SHIFT_LIMIT_MINUTES
    );
  });
});

describe("saving a preset as a real plan", () => {
  const apps: ScreenTimeItem[] = [
    { id: "app.1", label: "One", type: "application" },
    { id: "app.2", label: "Two", type: "application" },
    { id: "cat.1", label: "Social", type: "category" },
  ];

  it("produces the same shape the Timed Block screen edits", () => {
    expect(planFromPreset(study, 0, apps)).toEqual({
      label: "Study",
      daysOfWeek: [1, 2, 3, 4, 5],
      startHour: 19,
      startMinute: 0,
      endHour: 22,
      endMinute: 0,
      durationMinutes: 180,
      focusMode: "flexible",
      appIds: ["app.1", "app.2", "cat.1"],
      appsSummary: { appCount: 2, catCount: 1, webCount: 0 },
      enabled: true,
    });
  });

  it("applies the shift and clamps it", () => {
    const plan = planFromPreset(study, -SCHEDULE_SHIFT_LIMIT_MINUTES - 120, apps);
    expect(plan.startHour).toBe(16);
    expect(plan.endHour).toBe(19);
  });

  it("wraps a window that crosses midnight", () => {
    const plan = planFromPreset(bedtime, 0, []);
    expect(plan.startHour).toBe(23);
    expect(plan.endHour).toBe(7);
    expect(plan.appIds).toEqual([]);
  });
});
