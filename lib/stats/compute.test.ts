/** @jest-environment node */

import { computeStats } from "@/lib/stats/compute";
import type {
  DailyUsageSample,
  SessionAttempt,
  StatsInput,
} from "@/lib/stats/types";

function at(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month - 1, day, hour, 0, 0, 0).getTime();
}

// 2024-01-03 is a Wednesday, so the current week runs Mon 1st – Sun 7th.
const NOW = at(2024, 1, 3, 14);

function attempt(overrides: Partial<SessionAttempt> = {}): SessionAttempt {
  const startedAt = overrides.startedAt ?? at(2024, 1, 2, 9);
  const durationMinutes = overrides.durationMinutes ?? 60;
  return {
    startedAt,
    endedAt: startedAt + durationMinutes * 60_000,
    durationMinutes,
    focusedMinutes: overrides.completed === false ? 20 : durationMinutes,
    focusMode: "flexible",
    completed: true,
    ...overrides,
  };
}

function usage(day: number, totalMinutes: number, hourly?: number[]): DailyUsageSample {
  return {
    day,
    totalMinutes,
    apps: [
      { appId: "tiktok", label: "TikTok", minutes: totalMinutes * 0.5, distracting: true },
      { appId: "mail", label: "Mail", minutes: totalMinutes * 0.5, distracting: false },
    ],
    hourlyDistractingMinutes: hourly,
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

describe("computeStats — availability", () => {
  it("reports no-source, not not-enough-data, when nothing measures screen time", () => {
    const model = computeStats(input({ attempts: [attempt()] }), "week");

    expect(model.screenTime.unavailable).toBe("no-source");
    expect(model.distractions.unavailable).toBe("no-source");
    expect(model.screenTime.series).toEqual([]);
  });

  it("locks a premium period for a free account and leaves it open for premium", () => {
    expect(computeStats(input(), "month").periodLocked).toBe(true);
    expect(computeStats(input({ isPremium: true }), "month").periodLocked).toBe(false);
  });
});

describe("computeStats — focus", () => {
  it("totals focused minutes in the window and compares with the one before", () => {
    const model = computeStats(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 2, 9), durationMinutes: 90 }),
          attempt({ startedAt: at(2024, 1, 3, 9), durationMinutes: 30 }),
          // Previous week.
          attempt({ startedAt: at(2023, 12, 27, 9), durationMinutes: 60 }),
        ],
      }),
      "week"
    );

    expect(model.focus.totalMinutes).toBe(120);
    expect(model.focus.delta?.change).toBe(60);
    expect(model.focus.delta?.percent).toBe(1);
    expect(model.focus.delta?.tone).toBe("positive");
    expect(model.overview.hero.value).toBe("2h");
  });

  it("draws a zero column for a day with no sessions rather than a gap", () => {
    const model = computeStats(
      input({ attempts: [attempt({ startedAt: at(2024, 1, 2, 9) })] }),
      "week"
    );

    expect(model.focus.series).toHaveLength(7);
    expect(model.focus.series.every((point) => point.value !== null)).toBe(true);
    expect(model.focus.series[1].value).toBe(60);
    expect(model.focus.series[0].value).toBe(0);
  });

  it("leaves the comparison out when there is no previous window to compare with", () => {
    const model = computeStats(
      input({ attempts: [attempt({ startedAt: at(2024, 1, 2, 9) })] }),
      "week"
    );

    expect(model.focus.delta).toBeNull();
    expect(model.overview.hero.comparison).toBeNull();
  });
});

describe("computeStats — screen time", () => {
  const week = [
    usage(at(2024, 1, 1), 300),
    usage(at(2024, 1, 2), 260),
    usage(at(2024, 1, 3), 220),
  ];
  const previousWeek = [usage(at(2023, 12, 26), 360), usage(at(2023, 12, 27), 340)];

  it("averages over measured days, not the whole calendar window", () => {
    const model = computeStats(
      input({ usage: [...previousWeek, ...week], isPremium: true }),
      "week"
    );

    expect(model.screenTime.averageMinutesPerDay).toBe(260);
    expect(model.screenTime.delta?.change).toBe(-90);
    expect(model.screenTime.delta?.tone).toBe("positive");
  });

  it("leaves unmeasured buckets null so the chart breaks instead of drawing zero", () => {
    const model = computeStats(input({ usage: week }), "week");

    expect(model.screenTime.series[0].value).toBe(300);
    expect(model.screenTime.series[6].value).toBeNull();
  });

  it("states the gap against the starting point when one is known", () => {
    const model = computeStats(
      input({ usage: week, baselineMinutesPerDay: 372 }),
      "week"
    );

    expect(model.screenTime.interpretation).toBe(
      "You're using your phone 1h 52m less per day than when you started."
    );
    expect(model.screenTime.references).toHaveLength(1);
  });
});

describe("computeStats — reclaimed time", () => {
  it("measures against the baseline when usage is available", () => {
    const model = computeStats(
      input({
        usage: [usage(at(2024, 1, 1), 300), usage(at(2024, 1, 2), 240)],
        baselineMinutesPerDay: 360,
      }),
      "week"
    );

    expect(model.reclaimed.basis).toBe("below-baseline");
    expect(model.reclaimed.periodMinutes).toBe(180);
  });

  it("falls back to time spent inside blocks when nothing measures usage", () => {
    const model = computeStats(
      input({ attempts: [attempt({ startedAt: at(2024, 1, 2, 9), durationMinutes: 45 })] }),
      "week"
    );

    expect(model.reclaimed.basis).toBe("blocked-time");
    expect(model.reclaimed.periodMinutes).toBe(45);
    expect(model.reclaimed.unavailable).toBeNull();
  });

  it("never goes negative on a day spent above the baseline", () => {
    const model = computeStats(
      input({ usage: [usage(at(2024, 1, 1), 500)], baselineMinutesPerDay: 300 }),
      "week"
    );

    expect(model.reclaimed.periodMinutes).toBe(0);
  });
});

describe("computeStats — interpretation copy", () => {
  it("never repeats a figure already shown next to the chart", () => {
    const model = computeStats(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 1, 9), durationMinutes: 60 }),
          attempt({ startedAt: at(2024, 1, 2, 9), durationMinutes: 60 }),
        ],
      }),
      "week"
    );

    // The average sits beside the total, so the sentence reports the spread.
    expect(model.focus.interpretation).toBe("You focused on 2 of 7 days.");
    // The lifetime total is above it, so the sentence converts it to days.
    expect(model.reclaimed.interpretation).not.toContain(
      model.reclaimed.lifetimeMinutes.toString()
    );
  });

  it("states a quieter period as a fact, not a shortfall", () => {
    const model = computeStats(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 2, 9), durationMinutes: 30 }),
          attempt({ startedAt: at(2023, 12, 27, 9), durationMinutes: 120 }),
        ],
      }),
      "week"
    );

    expect(model.focus.interpretation).toBe(
      "A quieter stretch than last week, by 1h 30m."
    );
    expect(model.focus.interpretation).not.toMatch(/fail|missed|only|behind/i);
  });

  it("converts lifetime reclaimed time into whole days, kept grammatical", () => {
    const interpretationFor = (minutes: number) =>
      computeStats(
        input({
          attempts: [
            attempt({ startedAt: at(2023, 12, 5, 9), durationMinutes: minutes }),
          ],
        }),
        "week"
      ).reclaimed.interpretation;

    expect(interpretationFor(36 * 60)).toBe("You've gotten a full day back.");
    expect(interpretationFor(60 * 60)).toBe(
      "You've gotten more than two full days back."
    );
    expect(interpretationFor(71 * 60)).toBe(
      "You've gotten nearly three full days back."
    );
    expect(interpretationFor(30)).toBe("Every block you finish adds to this.");
  });

  it("never uses loss or guilt framing anywhere it interprets the numbers", () => {
    const model = computeStats(
      input({
        attempts: [attempt({ startedAt: at(2024, 1, 2, 9) })],
        usage: [usage(at(2024, 1, 1), 500), usage(at(2024, 1, 2), 480)],
        baselineMinutesPerDay: 300,
        goal: { minutesPerDay: 240, suggested: true },
      }),
      "week"
    );

    const sentences = [
      model.screenTime.interpretation,
      model.focus.interpretation,
      model.reclaimed.interpretation,
      model.goal.interpretation,
    ].filter((s): s is string => s !== null);

    expect(sentences.length).toBeGreaterThan(0);
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/wasted|failed|fail\b|too much|bad|should have/i);
    }
  });
});

describe("computeStats — goal", () => {
  it("frames going over the target without failure language", () => {
    const model = computeStats(
      input({
        usage: [usage(at(2024, 1, 1), 261)],
        goal: { minutesPerDay: 240, suggested: true },
        baselineMinutesPerDay: 360,
      }),
      "week"
    );

    expect(model.goal.interpretation).toBe("21m above your goal on average.");
    expect(model.goal.differenceMinutes).toBe(21);
    expect(model.goal.suggested).toBe(true);
  });

  it("fills the meter as the gap from the starting point closes", () => {
    const model = computeStats(
      input({
        usage: [usage(at(2024, 1, 1), 300)],
        goal: { minutesPerDay: 240, suggested: false },
        baselineMinutesPerDay: 360,
      }),
      "week"
    );

    expect(model.goal.progress).toBeCloseTo(0.5);
  });
});

describe("computeStats — sessions", () => {
  it("counts abandoned blocks in the rate and keeps their served minutes", () => {
    const model = computeStats(
      input({
        attempts: [
          attempt({ startedAt: at(2024, 1, 1, 9) }),
          attempt({ startedAt: at(2024, 1, 2, 9) }),
          attempt({ startedAt: at(2024, 1, 3, 9), completed: false }),
        ],
      }),
      "week"
    );

    expect(model.sessions.started).toBe(3);
    expect(model.sessions.completed).toBe(2);
    expect(model.sessions.completionRate).toBeCloseTo(2 / 3);
    expect(model.sessions.totalFocusedMinutes).toBe(140);
    expect(model.overview.supporting[2].caption).toBe("67% completion");
  });
});

describe("computeStats — distractions", () => {
  it("ranks only the apps the user flagged as distracting", () => {
    const model = computeStats(
      input({ usage: [usage(at(2024, 1, 1), 200), usage(at(2024, 1, 2), 100)] }),
      "week"
    );

    expect(model.distractions.apps.map((a) => a.appId)).toEqual(["tiktok"]);
    expect(model.distractions.apps[0].minutes).toBe(150);
    expect(model.distractions.apps[0].averageMinutesPerDay).toBe(75);
  });
});

describe("computeStats — new users", () => {
  it("flags an account with almost no history", () => {
    expect(computeStats(input(), "week").isNewUser).toBe(true);
    expect(
      computeStats(
        input({
          attempts: [
            attempt({ startedAt: at(2024, 1, 1, 9) }),
            attempt({ startedAt: at(2024, 1, 2, 9) }),
            attempt({ startedAt: at(2024, 1, 3, 9) }),
          ],
          usage: [
            usage(at(2024, 1, 1), 200),
            usage(at(2024, 1, 2), 200),
            usage(at(2024, 1, 3), 200),
          ],
        }),
        "week"
      ).isNewUser
    ).toBe(false);
  });
});
