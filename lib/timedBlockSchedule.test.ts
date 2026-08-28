/** @jest-environment node */

import { findActiveOccurrence, occurrenceKey } from "@/lib/timedBlockSchedule";
import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";

function makePlan(overrides: Partial<TimedBlockPlan> = {}): TimedBlockPlan {
  return {
    id: "plan-1",
    label: "Study",
    daysOfWeek: [1], // Monday
    startHour: 9,
    startMinute: 0,
    endHour: 11,
    endMinute: 0,
    durationMinutes: 120,
    focusMode: "flexible",
    appIds: [],
    appsSummary: { appCount: 0, catCount: 0, webCount: 0 },
    enabled: true,
    ...overrides,
  };
}

/** Local-time timestamp, so the assertions match the local-time schedule maths. */
function at(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

// 2024-01-01 is a Monday.
const MONDAY = { year: 2024, month: 1, day: 1 };
const TUESDAY = { year: 2024, month: 1, day: 2 };

describe("findActiveOccurrence", () => {
  it("matches a plan inside its window", () => {
    const plan = makePlan();
    const occurrence = findActiveOccurrence([plan], at(2024, 1, 1, 10));

    expect(occurrence).not.toBeNull();
    expect(occurrence!.plan.id).toBe("plan-1");
    expect(occurrence!.startsAt).toBe(at(MONDAY.year, MONDAY.month, MONDAY.day, 9));
    expect(occurrence!.endsAt).toBe(at(MONDAY.year, MONDAY.month, MONDAY.day, 11));
  });

  it("includes the first minute and excludes the last", () => {
    const plan = makePlan();
    expect(findActiveOccurrence([plan], at(2024, 1, 1, 9))).not.toBeNull();
    expect(findActiveOccurrence([plan], at(2024, 1, 1, 11))).toBeNull();
  });

  it("ignores a disabled plan", () => {
    const plan = makePlan({ enabled: false });
    expect(findActiveOccurrence([plan], at(2024, 1, 1, 10))).toBeNull();
  });

  it("ignores a day the plan does not run on", () => {
    const plan = makePlan({ daysOfWeek: [2] }); // Tuesday only
    expect(findActiveOccurrence([plan], at(2024, 1, 1, 10))).toBeNull();
  });

  it("still matches an overnight block that started the previous day", () => {
    // Monday 23:00 for 4h — at 01:00 Tuesday it is still running.
    const plan = makePlan({
      startHour: 23,
      endHour: 3,
      durationMinutes: 240,
    });
    const occurrence = findActiveOccurrence([plan], at(TUESDAY.year, TUESDAY.month, TUESDAY.day, 1));

    expect(occurrence).not.toBeNull();
    expect(occurrence!.startsAt).toBe(at(MONDAY.year, MONDAY.month, MONDAY.day, 23));
  });

  it("returns the first enabled plan when several are in window", () => {
    const first = makePlan({ id: "a" });
    const second = makePlan({ id: "b" });
    expect(findActiveOccurrence([first, second], at(2024, 1, 1, 10))!.plan.id).toBe("a");
  });
});

describe("occurrenceKey", () => {
  it("distinguishes two runs of the same plan", () => {
    const monday = occurrenceKey("plan-1", at(2024, 1, 1, 9));
    const nextMonday = occurrenceKey("plan-1", at(2024, 1, 8, 9));
    expect(monday).not.toBe(nextMonday);
  });

  it("is stable for the same run", () => {
    const startsAt = at(2024, 1, 1, 9);
    expect(occurrenceKey("plan-1", startsAt)).toBe(occurrenceKey("plan-1", startsAt));
  });
});
