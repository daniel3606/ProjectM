import { formatMinutes, formatPercent } from "./format";
import { formatHourWindow } from "./time";
import type {
  DailyUsageSample,
  Insight,
  InsightsModel,
  PeriodRange,
  Recommendation,
  SessionAttempt,
  StatsInput,
} from "./types";

/**
 * Thresholds below which a pattern is a coincidence rather than a finding.
 * Insights are the premium promise, so they stay quiet until they'd be right.
 */
const MIN_ATTEMPTS_FOR_WINDOW = 6;
const MIN_ATTEMPTS_PER_MODE = 4;
const MIN_DAYS_FOR_HOURLY = 4;
const MIN_LIFT = 0.1;

const MAX_INSIGHTS = 4;

interface HourWindow {
  startHour: number;
  endHour: number;
}

function windowFor(hour: number): HourWindow {
  // Two-hour windows: narrow enough to act on, wide enough to be stable.
  const start = Math.floor(hour / 2) * 2;
  return { startHour: start, endHour: start + 2 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Strongest focus window
// ─────────────────────────────────────────────────────────────────────────────

function strongestFocusWindow(attempts: SessionAttempt[]): Insight | null {
  if (attempts.length < MIN_ATTEMPTS_FOR_WINDOW) return null;

  const buckets = new Map<number, { started: number; completed: number }>();
  for (const attempt of attempts) {
    const key = windowFor(new Date(attempt.startedAt).getHours()).startHour;
    const bucket = buckets.get(key) ?? { started: 0, completed: 0 };
    bucket.started += 1;
    if (attempt.completed) bucket.completed += 1;
    buckets.set(key, bucket);
  }

  const overallRate = attempts.filter((a) => a.completed).length / attempts.length;

  // Only windows with enough runs of their own can claim to be the strong one.
  const eligible = [...buckets.entries()].filter(([, b]) => b.started >= 3);
  if (eligible.length < 2) return null;

  const best = eligible.reduce((top, entry) =>
    entry[1].completed / entry[1].started > top[1].completed / top[1].started ? entry : top
  );

  const bestRate = best[1].completed / best[1].started;
  if (overallRate <= 0 || bestRate - overallRate < MIN_LIFT) return null;

  const lift = bestRate / overallRate - 1;
  const window = windowFor(best[0]);

  return {
    id: "strongestFocusWindow",
    title: "Your strongest focus window",
    headline: formatHourWindow(window.startHour, window.endHour),
    detail: `Sessions started in this window are ${formatPercent(lift)} more likely to finish.`,
    requiresPremium: true,
    teaser: "See when you naturally focus best.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Biggest distraction window
// ─────────────────────────────────────────────────────────────────────────────

function hourlyTotals(samples: DailyUsageSample[]): number[] | null {
  const withHourly = samples.filter((s) => s.hourlyDistractingMinutes?.length === 24);
  if (withHourly.length < MIN_DAYS_FOR_HOURLY) return null;

  const totals = new Array(24).fill(0) as number[];
  for (const sample of withHourly) {
    sample.hourlyDistractingMinutes!.forEach((m, h) => {
      totals[h] += m;
    });
  }
  return totals;
}

/** The consecutive two-hour block carrying the most distracting minutes. */
export function peakDistractionWindow(
  totals: number[]
): { startHour: number; endHour: number; share: number } | null {
  const grand = totals.reduce((s, v) => s + v, 0);
  if (grand <= 0) return null;

  let bestStart = 0;
  let bestSum = -1;
  for (let start = 0; start < 24; start += 2) {
    const windowSum = totals[start] + totals[(start + 1) % 24];
    if (windowSum > bestSum) {
      bestSum = windowSum;
      bestStart = start;
    }
  }

  return { startHour: bestStart, endHour: bestStart + 2, share: bestSum / grand };
}

function biggestDistractionWindow(samples: DailyUsageSample[]): Insight | null {
  const totals = hourlyTotals(samples);
  if (!totals) return null;

  const peak = peakDistractionWindow(totals);
  // A flat day has no peak worth naming; 2 of 24 hours is 8.3% by chance alone.
  if (!peak || peak.share < 0.15) return null;

  return {
    id: "biggestDistractionWindow",
    title: "Your biggest distraction window",
    headline: formatHourWindow(peak.startHour, peak.endHour),
    detail: `${formatPercent(peak.share)} of your distracting usage happens in this window.`,
    requiresPremium: true,
    teaser: "Find the hours that pull you away.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Most effective schedule
// ─────────────────────────────────────────────────────────────────────────────

function mostEffectiveSchedule(
  attempts: SessionAttempt[],
  range: PeriodRange
): Insight | null {
  const scheduled = attempts.filter(
    (a) => a.planId && a.startedAt >= range.start && a.startedAt < range.end
  );
  if (scheduled.length < 2) return null;

  const byPlan = new Map<string, { label: string; minutes: number }>();
  for (const attempt of scheduled) {
    const entry = byPlan.get(attempt.planId!) ?? {
      label: attempt.planLabel ?? "Schedule",
      minutes: 0,
    };
    entry.minutes += attempt.focusedMinutes;
    byPlan.set(attempt.planId!, entry);
  }

  const best = [...byPlan.values()].reduce((top, entry) =>
    entry.minutes > top.minutes ? entry : top
  );
  if (best.minutes < 30) return null;

  return {
    id: "mostEffectiveSchedule",
    title: "Your most effective schedule",
    headline: best.label,
    detail: `This schedule held ${formatMinutes(best.minutes)} of distraction-free time ${
      range.id === "today" ? "today" : `this ${range.label.toLowerCase()}`
    }.`,
    requiresPremium: true,
    teaser: "See which schedules actually work for you.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deep Focus performance
// ─────────────────────────────────────────────────────────────────────────────

function deepFocusPerformance(attempts: SessionAttempt[]): Insight | null {
  const deep = attempts.filter((a) => a.focusMode === "deep");
  const flexible = attempts.filter((a) => a.focusMode === "flexible");
  if (deep.length < MIN_ATTEMPTS_PER_MODE || flexible.length < MIN_ATTEMPTS_PER_MODE) {
    return null;
  }

  const deepRate = deep.filter((a) => a.completed).length / deep.length;
  const flexRate = flexible.filter((a) => a.completed).length / flexible.length;
  if (flexRate <= 0) return null;

  const lift = deepRate / flexRate - 1;
  if (Math.abs(lift) < MIN_LIFT) return null;

  const better = lift > 0;
  return {
    id: "deepFocusPerformance",
    title: better ? "Deep Focus works better for you" : "Flexible sessions suit you better",
    headline: better ? "Deep Focus" : "Flexible",
    detail: better
      ? `You complete Deep Focus sessions ${formatPercent(lift)} more often than flexible ones.`
      : `You complete flexible sessions ${formatPercent(-lift / (1 + lift))} more often than Deep Focus.`,
    requiresPremium: true,
    teaser: "Learn which focus mode fits you.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function computeInsights(input: StatsInput, range: PeriodRange): InsightsModel {
  const samples = input.usage?.filter((s) => s.day >= range.start && s.day < range.end) ?? [];

  const found = [
    strongestFocusWindow(input.attempts),
    biggestDistractionWindow(samples),
    mostEffectiveSchedule(input.attempts, range),
    deepFocusPerformance(input.attempts),
  ].filter((i): i is Insight => i !== null);

  // Free accounts still see that insights exist and what they'd cover, so the
  // teasers stand in for real findings rather than the section disappearing.
  if (!input.isPremium) {
    return {
      unavailable: null,
      insights: (found.length > 0 ? found : previewInsights()).slice(0, 2),
      locked: true,
    };
  }

  if (found.length === 0) {
    return { unavailable: "not-enough-data", insights: [], locked: false };
  }

  return { unavailable: null, insights: found.slice(0, MAX_INSIGHTS), locked: false };
}

/**
 * Shown to free accounts with nothing computed yet. These carry no numbers —
 * they describe what the insight would tell you, which is the point of the
 * preview and keeps invented figures off the screen.
 */
function previewInsights(): Insight[] {
  return [
    {
      id: "strongestFocusWindow",
      title: "Your strongest focus window",
      headline: "Premium",
      detail: "",
      requiresPremium: true,
      teaser: "See when you naturally focus best.",
    },
    {
      id: "biggestDistractionWindow",
      title: "Your biggest distraction window",
      headline: "Premium",
      detail: "",
      requiresPremium: true,
      teaser: "Find the hours that pull you away.",
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommendation
// ─────────────────────────────────────────────────────────────────────────────

const WEEKDAYS = [1, 2, 3, 4, 5];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * The one thing to do next. Protecting the worst window beats reinforcing the
 * best one, so a distraction peak wins when both are known; otherwise the
 * strongest focus window is turned into a standing block.
 */
export function computeRecommendation(
  input: StatsInput,
  range: PeriodRange,
  insights: Insight[]
): Recommendation | null {
  const samples = input.usage?.filter((s) => s.day >= range.start && s.day < range.end) ?? [];
  const totals = hourlyTotals(samples);
  const peak = totals ? peakDistractionWindow(totals) : null;

  if (peak && peak.share >= 0.15 && !hasScheduleCovering(input, peak.startHour)) {
    const weeklyMinutes = estimateWeeklyMinutes(samples, peak.startHour);
    return {
      id: `protect-${peak.startHour}`,
      title: peak.startHour >= 18 ? "Protect your evenings" : "Protect your peak window",
      reason: `${formatPercent(peak.share)} of your distracting time happens between ${
        formatHourWindow(peak.startHour, peak.endHour)
      }.`,
      benefit:
        weeklyMinutes >= 30
          ? `Blocking this window could give you back around ${formatMinutes(weeklyMinutes)} a week.`
          : "A standing block here would keep that window clear.",
      action: {
        id: "create-schedule",
        label: "Create Schedule",
        draft: {
          label: peak.startHour >= 18 ? "Evenings" : "Focus Window",
          startHour: peak.startHour,
          endHour: peak.endHour,
          daysOfWeek: EVERY_DAY,
        },
      },
    };
  }

  const strongest = insights.find((i) => i.id === "strongestFocusWindow");
  if (strongest && !strongest.detail.includes("Premium")) {
    const startHour = parseWindowStart(strongest.headline);
    if (startHour !== null && !hasScheduleCovering(input, startHour)) {
      return {
        id: `use-strong-${startHour}`,
        title: "Use your strongest hours",
        reason: strongest.detail,
        benefit: "A standing block here would make your best window the default.",
        action: {
          id: "schedule-focus",
          label: "Schedule Focus",
          draft: {
            label: "Peak Focus",
            startHour,
            endHour: startHour + 2,
            daysOfWeek: WEEKDAYS,
          },
        },
      };
    }
  }

  return null;
}

function hasScheduleCovering(input: StatsInput, hour: number): boolean {
  return input.schedules.some((plan) => {
    if (!plan.enabled) return false;
    const start = plan.startHour * 60 + plan.startMinute;
    const end = start + plan.durationMinutes;
    const target = hour * 60;
    return target >= start && target < end;
  });
}

/** Distracting minutes inside the window, scaled to a week. */
function estimateWeeklyMinutes(samples: DailyUsageSample[], startHour: number): number {
  const withHourly = samples.filter((s) => s.hourlyDistractingMinutes?.length === 24);
  if (withHourly.length === 0) return 0;

  const total = withHourly.reduce(
    (acc, s) =>
      acc + s.hourlyDistractingMinutes![startHour] + s.hourlyDistractingMinutes![startHour + 1],
    0
  );
  return (total / withHourly.length) * 7;
}

function parseWindowStart(headline: string): number | null {
  const match = /^(\d{1,2})\s*(AM|PM)/.exec(headline);
  if (!match) return null;
  const raw = Number(match[1]) % 12;
  return match[2] === "PM" ? raw + 12 : raw;
}
