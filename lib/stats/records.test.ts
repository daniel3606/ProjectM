/** @jest-environment node */

import { acknowledgeRecords, computeRecords } from "@/lib/stats/records";
import type { PersonalBestRecord, SessionAttempt, StatsInput } from "@/lib/stats/types";

function at(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

const NOW = at(2024, 1, 10, 12);

function attempt(
  startedAt: number,
  focusedMinutes: number,
  completed = true
): SessionAttempt {
  return {
    startedAt,
    endedAt: startedAt + focusedMinutes * 60_000,
    durationMinutes: focusedMinutes,
    focusedMinutes,
    focusMode: "flexible",
    completed,
  };
}

function input(overrides: Partial<StatsInput> = {}): StatsInput {
  return {
    now: NOW,
    attempts: [],
    usage: null,
    baselineMinutesPerDay: null,
    goal: null,
    joinedAt: at(2023, 12, 1),
    schedules: [],
    personalBests: [],
    isPremium: false,
    ...overrides,
  };
}

function bestById(model: ReturnType<typeof computeRecords>, id: string) {
  return model.bests.find((b) => b.id === id)!;
}

describe("computeRecords", () => {
  it("takes the longest single session, the best day and the best week", () => {
    const model = computeRecords(
      input({
        attempts: [
          // Mon 1st and Tue 2nd are the same week; 8th is the next one.
          attempt(at(2024, 1, 1, 9), 60),
          attempt(at(2024, 1, 1, 14), 90),
          attempt(at(2024, 1, 2, 9), 45),
          attempt(at(2024, 1, 8, 9), 120),
        ],
      })
    );

    expect(bestById(model, "longestSession").value).toBe(120);
    expect(bestById(model, "mostFocusedDay").value).toBe(150);
    expect(bestById(model, "bestWeek").value).toBe(195);
  });

  it("ignores blocks the user ended early", () => {
    const model = computeRecords(
      input({
        attempts: [attempt(at(2024, 1, 1, 9), 30), attempt(at(2024, 1, 2, 9), 200, false)],
      })
    );

    expect(bestById(model, "longestSession").value).toBe(30);
  });

  it("separates no-source from not-enough-data on the usage-backed records", () => {
    const noUsage = computeRecords(input({ attempts: [attempt(at(2024, 1, 1, 9), 30)] }));
    expect(bestById(noUsage, "lowestScreenTime").unavailable).toBe("no-source");

    // A connected source that has not produced a settled day yet is a
    // "come back later", not a missing capability.
    const emptyUsage = computeRecords(
      input({ attempts: [attempt(at(2024, 1, 1, 9), 30)], usage: [] })
    );
    expect(bestById(emptyUsage, "lowestScreenTime").unavailable).toBe("not-enough-data");
  });

  it("marks a record new only when it beats what was already acknowledged", () => {
    const stored: PersonalBestRecord[] = [
      { id: "longestSession", value: 120, achievedAt: at(2024, 1, 1), seen: true },
    ];

    const unchanged = computeRecords(
      input({ attempts: [attempt(at(2024, 1, 2, 9), 120)], personalBests: stored })
    );
    expect(bestById(unchanged, "longestSession").isNew).toBe(false);

    const beaten = computeRecords(
      input({ attempts: [attempt(at(2024, 1, 2, 9), 130)], personalBests: stored })
    );
    expect(beaten.newlySet).toContain("longestSession");
  });

  it("treats a lower screen time as the better record", () => {
    const stored: PersonalBestRecord[] = [
      { id: "lowestScreenTime", value: 180, achievedAt: at(2024, 1, 1), seen: true },
    ];

    const model = computeRecords(
      input({
        personalBests: stored,
        usage: [
          { day: at(2024, 1, 8), totalMinutes: 150, apps: [] },
          { day: at(2024, 1, 9), totalMinutes: 240, apps: [] },
        ],
      })
    );

    expect(bestById(model, "lowestScreenTime").value).toBe(150);
    expect(bestById(model, "lowestScreenTime").isNew).toBe(true);
  });

  it("reports nothing achieved when there is no history at all", () => {
    const model = computeRecords(input());

    expect(model.unavailable).toBe("not-enough-data");
    expect(model.bests.every((b) => b.display === null)).toBe(true);
    expect(model.newlySet).toEqual([]);
  });
});

describe("acknowledgeRecords", () => {
  it("stores only the records that have actually been set, marked seen", () => {
    const model = computeRecords(
      input({ attempts: [attempt(at(2024, 1, 2, 9), 75)] })
    );
    const stored = acknowledgeRecords(model.bests, NOW);

    expect(stored.map((r) => r.id)).toEqual([
      "longestSession",
      "mostFocusedDay",
      "bestWeek",
    ]);
    expect(stored.every((r) => r.seen)).toBe(true);
  });

  it("stops a record repeating its new state on the next visit", () => {
    const first = computeRecords(input({ attempts: [attempt(at(2024, 1, 2, 9), 75)] }));
    expect(first.newlySet.length).toBeGreaterThan(0);

    const second = computeRecords(
      input({
        attempts: [attempt(at(2024, 1, 2, 9), 75)],
        personalBests: acknowledgeRecords(first.bests, NOW),
      })
    );
    expect(second.newlySet).toEqual([]);
  });
});
