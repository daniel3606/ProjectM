/** @jest-environment node */

import { computeStats } from "@/lib/stats/compute";
import {
  computeAppUsage,
  computeGrowth,
  computeScreenTimeStat,
  computeTimeBlocked,
  computeTrend,
} from "@/lib/stats/summary";
import { resolvePeriod } from "@/lib/stats/time";
import type {
  AppUsageSample,
  DailyUsageSample,
  SessionAttempt,
  StatsInput,
  StatsPeriodId,
} from "@/lib/stats/types";

function at(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

// 2024-01-03 is a Wednesday, so the current week runs Mon 1st – Sun 7th.
const NOW = at(2024, 1, 3, 14);

function attempt(overrides: Partial<SessionAttempt> = {}): SessionAttempt {
  const startedAt = overrides.startedAt ?? at(2024, 1, 3, 9);
  const durationMinutes = overrides.durationMinutes ?? 60;
  return {
    startedAt,
    endedAt: startedAt + durationMinutes * 60_000,
    durationMinutes,
    focusedMinutes: durationMinutes,
    focusMode: "flexible",
    completed: true,
    growthCm: 1,
    ...overrides,
  };
}

function app(
  appId: string,
  minutes: number,
  overrides: Partial<AppUsageSample> = {}
): AppUsageSample {
  return { appId, label: appId, minutes, distracting: false, ...overrides };
}

function usage(
  day: number,
  totalMinutes: number,
  apps: AppUsageSample[] = []
): DailyUsageSample {
  return { day, totalMinutes, apps };
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

function range(id: StatsPeriodId) {
  return resolvePeriod(id, NOW);
}

describe("computeGrowth", () => {
  it("totals the growth completed blocks earned inside the period", () => {
    const growth = computeGrowth(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 3, 9), growthCm: 4.2 }),
          attempt({ startedAt: at(2024, 1, 3, 15), growthCm: 8.5 }),
        ],
      }),
      range("today")
    );

    expect(growth.periodCm).toBeCloseTo(12.7);
    expect(growth.display).toBe("12.7cm");
  });

  it("ignores blocks the user ended early, which earn nothing", () => {
    const growth = computeGrowth(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 3, 9), completed: false, growthCm: 0 }),
          attempt({ startedAt: at(2024, 1, 3, 15), growthCm: 3 }),
        ],
      }),
      range("today")
    );

    expect(growth.display).toBe("3.0cm");
  });

  it("compares against the same-length window before it", () => {
    const growth = computeGrowth(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 3, 9), growthCm: 6 }),
          attempt({ startedAt: at(2024, 1, 2, 9), growthCm: 3 }),
        ],
      }),
      range("today")
    );

    expect(growth.delta?.percent).toBeCloseTo(1);
    expect(growth.tone).toBe("positive");
    expect(growth.comparison).toBe("↑ 100% vs yesterday");
  });

  it("says not-enough-data rather than 0.0cm when history predates growth tracking", () => {
    const legacy = attempt({ startedAt: at(2024, 1, 3, 9) });
    delete legacy.growthCm;

    const growth = computeGrowth(input({ attempts: [legacy] }), range("today"));

    expect(growth.unavailable).toBe("not-enough-data");
    expect(growth.display).toBe("—");
  });

  it("reports a truthful zero when the day simply had no completed blocks", () => {
    const growth = computeGrowth(
      input({ attempts: [attempt({ startedAt: at(2024, 1, 2, 9), growthCm: 5 })] }),
      range("today")
    );

    expect(growth.unavailable).toBeNull();
    expect(growth.display).toBe("0.0cm");
  });
});

describe("computeTimeBlocked", () => {
  it("totals focused minutes and compares with the previous window", () => {
    const stat = computeTimeBlocked(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 3, 9), durationMinutes: 120 }),
          attempt({ startedAt: at(2024, 1, 2, 9), durationMinutes: 60 }),
        ],
      }),
      range("today")
    );

    expect(stat.value).toBe("2h");
    expect(stat.change).toBe("↑ 100%");
    expect(stat.tone).toBe("positive");
  });

  it("counts the minutes served by a block the user ended early", () => {
    const stat = computeTimeBlocked(
      input({
        attempts: [
          attempt({
            startedAt: at(2024, 1, 3, 9),
            durationMinutes: 60,
            focusedMinutes: 20,
            completed: false,
          }),
        ],
      }),
      range("today")
    );

    expect(stat.value).toBe("20m");
  });

  it("reads as unavailable when the account has never started a block", () => {
    const stat = computeTimeBlocked(input(), range("today"));

    expect(stat.unavailable).toBe("not-enough-data");
    expect(stat.value).toBe("—");
  });
});

describe("computeScreenTimeStat", () => {
  it("separates no-source from a source that has no samples yet", () => {
    expect(computeScreenTimeStat(input(), range("today")).unavailable).toBe("no-source");
    expect(computeScreenTimeStat(input({ usage: [] }), range("today")).unavailable).toBe(
      "not-enough-data"
    );
  });

  it("treats less screen time as progress", () => {
    const stat = computeScreenTimeStat(
      input({
        usage: [usage(at(2024, 1, 3), 180), usage(at(2024, 1, 2), 240)],
      }),
      range("today")
    );

    expect(stat.value).toBe("3h");
    expect(stat.change).toBe("↓ 25%");
    expect(stat.tone).toBe("positive");
  });

  it("leaves the change off when there is nothing to compare against", () => {
    const stat = computeScreenTimeStat(
      input({ usage: [usage(at(2024, 1, 3), 180)] }),
      range("today")
    );

    expect(stat.change).toBeNull();
    expect(stat.tone).toBe("neutral");
  });
});

describe("computeAppUsage", () => {
  it("ranks apps longest first and scales each row against the busiest", () => {
    const model = computeAppUsage(
      input({
        usage: [
          usage(at(2024, 1, 3), 180, [
            app("instagram", 60),
            app("youtube", 113),
            app("settings", 7),
          ]),
        ],
      }),
      range("today")
    );

    expect(model.apps.map((a) => a.appId)).toEqual(["youtube", "instagram", "settings"]);
    expect(model.apps[0].display).toBe("1h 53m");
    expect(model.apps[0].share).toBe(1);
    expect(model.apps[1].share).toBeCloseTo(60 / 113);
    expect(model.totalMinutes).toBe(180);
  });

  it("sums an app across every day of a longer period", () => {
    const model = computeAppUsage(
      input({
        usage: [
          usage(at(2024, 1, 1), 60, [app("youtube", 60)]),
          usage(at(2024, 1, 2), 30, [app("youtube", 30)]),
        ],
      }),
      range("week")
    );

    expect(model.apps[0].minutes).toBe(90);
  });

  it("keeps the token and type a sample carries, so the row can draw an icon", () => {
    const model = computeAppUsage(
      input({
        usage: [
          usage(at(2024, 1, 3), 60, [
            app("games", 60, { token: "abc", itemType: "category" }),
          ]),
        ],
      }),
      range("today")
    );

    expect(model.apps[0].token).toBe("abc");
    expect(model.apps[0].itemType).toBe("category");
  });

  it("defaults to an application token when the source doesn't say", () => {
    const model = computeAppUsage(
      input({ usage: [usage(at(2024, 1, 3), 60, [app("youtube", 60)])] }),
      range("today")
    );

    expect(model.apps[0].token).toBeNull();
    expect(model.apps[0].itemType).toBe("application");
  });
});

describe("computeTrend", () => {
  it("charts screen time and blocked time on the same buckets", () => {
    const model = computeTrend(
      input({
        usage: [usage(at(2024, 1, 1), 200), usage(at(2024, 1, 2), 150)],
        attempts: [attempt({ startedAt: at(2024, 1, 2, 9), durationMinutes: 45 })],
      }),
      range("week")
    );

    const [screenTime, blocked] = model.series;
    expect(screenTime.points).toHaveLength(7);
    expect(blocked.points).toHaveLength(7);
    expect(screenTime.points[0].value).toBe(200);
    expect(blocked.points[1].value).toBe(45);
  });

  it("leaves a bucket null when nothing measured it, rather than drawing a zero", () => {
    const model = computeTrend(
      input({ usage: [usage(at(2024, 1, 1), 200)] }),
      range("week")
    );

    expect(model.series[0].points[0].value).toBe(200);
    expect(model.series[0].points[3].value).toBeNull();
  });

  it("still charts blocked time when no screen-time source is connected", () => {
    const model = computeTrend(
      input({ attempts: [attempt({ startedAt: at(2024, 1, 2, 9) })] }),
      range("week")
    );

    expect(model.unavailable).toBeNull();
    expect(model.series[0].unavailable).toBe("no-source");
    expect(model.series[1].unavailable).toBeNull();
  });
});

describe("computeStats — summary card", () => {
  it("leads Today with growth and no chart", () => {
    const model = computeStats(input({ attempts: [attempt()] }), "today");

    expect(model.summary.trend).toBeNull();
    expect(model.summary.growth.unavailable).toBeNull();
  });

  it("leads a longer period with the chart instead", () => {
    const model = computeStats(input({ attempts: [attempt()] }), "week");

    expect(model.summary.trend).not.toBeNull();
  });

  it("carries the same app usage the card's icons and the list both draw", () => {
    const model = computeStats(
      input({
        usage: [
          usage(at(2024, 1, 3), 120, [
            app("a", 50),
            app("b", 40),
            app("c", 20),
            app("d", 8),
            app("e", 2),
          ]),
        ],
      }),
      "today"
    );

    expect(model.appUsage.apps).toHaveLength(5);
    expect(model.summary.mostUsed).toHaveLength(4);
    expect(model.summary.mostUsed[0]).toBe(model.appUsage.apps[0]);
  });
});
