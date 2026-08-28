/** @jest-environment node */

import {
  computeInsights,
  computeRecommendation,
  peakDistractionWindow,
} from "@/lib/stats/insights";
import { resolvePeriod } from "@/lib/stats/time";
import type {
  DailyUsageSample,
  SessionAttempt,
  StatsInput,
} from "@/lib/stats/types";

function at(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

const NOW = at(2024, 1, 3, 14);
const WEEK = resolvePeriod("week", NOW);

function attempt(
  startedAt: number,
  completed: boolean,
  overrides: Partial<SessionAttempt> = {}
): SessionAttempt {
  return {
    startedAt,
    endedAt: startedAt + 60 * 60_000,
    durationMinutes: 60,
    focusedMinutes: completed ? 60 : 15,
    focusMode: "flexible",
    completed,
    ...overrides,
  };
}

/** A day whose distracting minutes all land in one hour. */
function dayWithPeak(day: number, peakHour: number, minutes: number): DailyUsageSample {
  const hourly = new Array(24).fill(2) as number[];
  hourly[peakHour] = minutes;
  return { day, totalMinutes: 300, apps: [], hourlyDistractingMinutes: hourly };
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
    isPremium: true,
    ...overrides,
  };
}

describe("peakDistractionWindow", () => {
  it("finds the two-hour block carrying the most distracting minutes", () => {
    const totals = new Array(24).fill(1) as number[];
    totals[22] = 60;
    totals[23] = 40;

    const peak = peakDistractionWindow(totals);
    expect(peak).toEqual({ startHour: 22, endHour: 24, share: 100 / 122 });
  });

  it("returns nothing for a day with no distracting usage", () => {
    expect(peakDistractionWindow(new Array(24).fill(0))).toBeNull();
  });
});

describe("computeInsights", () => {
  it("stays quiet until there are enough sessions to mean anything", () => {
    const model = computeInsights(
      input({ attempts: [attempt(at(2024, 1, 1, 9), true)] }),
      WEEK
    );

    expect(model.unavailable).toBe("not-enough-data");
    expect(model.insights).toEqual([]);
  });

  it("names the window where sessions are most likely to finish", () => {
    const attempts = [
      attempt(at(2024, 1, 1, 9), true),
      attempt(at(2024, 1, 2, 9), true),
      attempt(at(2024, 1, 3, 9), true),
      attempt(at(2024, 1, 1, 20), false),
      attempt(at(2024, 1, 2, 20), false),
      attempt(at(2024, 1, 3, 20), false),
    ];

    const model = computeInsights(input({ attempts }), WEEK);
    const insight = model.insights.find((i) => i.id === "strongestFocusWindow");

    expect(insight?.headline).toBe("8 AM – 10 AM");
    expect(insight?.detail).toContain("more likely to finish");
  });

  it("names the window most distracting usage falls in", () => {
    const usage = [22, 22, 22, 22].map((hour, i) =>
      dayWithPeak(at(2024, 1, i + 1), hour, 120)
    );

    const model = computeInsights(input({ usage }), WEEK);
    const insight = model.insights.find((i) => i.id === "biggestDistractionWindow");

    expect(insight?.headline).toBe("10 PM – 12 AM");
  });

  it("shows free accounts what insights cover, with no invented numbers", () => {
    const model = computeInsights(input({ isPremium: false }), WEEK);

    expect(model.locked).toBe(true);
    expect(model.insights).toHaveLength(2);
    expect(model.insights.every((i) => i.detail === "")).toBe(true);
  });

  it("never shows more than four at once", () => {
    const attempts = [
      ...Array.from({ length: 5 }, (_, i) =>
        attempt(at(2024, 1, 1, 9), true, { planId: "p1", planLabel: "Study" })
      ),
      ...Array.from({ length: 5 }, () => attempt(at(2024, 1, 2, 20), false)),
      ...Array.from({ length: 5 }, () =>
        attempt(at(2024, 1, 2, 9), true, { focusMode: "deep" })
      ),
    ];

    const model = computeInsights(
      input({
        attempts,
        usage: [1, 2, 3, 4].map((d) => dayWithPeak(at(2024, 1, d), 22, 120)),
      }),
      WEEK
    );

    expect(model.insights.length).toBeLessThanOrEqual(4);
  });
});

describe("computeRecommendation", () => {
  const eveningUsage = [1, 2, 3, 4].map((d) => dayWithPeak(at(2024, 1, d), 22, 120));

  it("turns the worst window into a schedule the user can create", () => {
    const recommendation = computeRecommendation(input({ usage: eveningUsage }), WEEK, []);

    expect(recommendation?.title).toBe("Protect your evenings");
    expect(recommendation?.action.id).toBe("create-schedule");
    expect(recommendation?.action.draft.startHour).toBe(22);
    expect(recommendation?.action.draft.endHour).toBe(24);
  });

  it("does not suggest a window the user already has a block covering", () => {
    const recommendation = computeRecommendation(
      input({
        usage: eveningUsage,
        schedules: [
          {
            id: "p1",
            label: "Evenings",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            startHour: 21,
            startMinute: 0,
            durationMinutes: 180,
            enabled: true,
          },
        ],
      }),
      WEEK,
      []
    );

    expect(recommendation).toBeNull();
  });

  it("ignores a disabled schedule when checking for coverage", () => {
    const recommendation = computeRecommendation(
      input({
        usage: eveningUsage,
        schedules: [
          {
            id: "p1",
            label: "Evenings",
            daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
            startHour: 21,
            startMinute: 0,
            durationMinutes: 180,
            enabled: false,
          },
        ],
      }),
      WEEK,
      []
    );

    expect(recommendation?.action.draft.startHour).toBe(22);
  });

  it("falls back to the strongest focus window when usage says nothing", () => {
    const recommendation = computeRecommendation(input(), WEEK, [
      {
        id: "strongestFocusWindow",
        title: "Your strongest focus window",
        headline: "9 AM – 11 AM",
        detail: "Sessions started in this window are 31% more likely to finish.",
        requiresPremium: true,
        teaser: "",
      },
    ]);

    expect(recommendation?.action.id).toBe("schedule-focus");
    expect(recommendation?.action.draft.startHour).toBe(9);
  });

  it("has nothing to suggest without data behind it", () => {
    expect(computeRecommendation(input(), WEEK, [])).toBeNull();
  });
});
