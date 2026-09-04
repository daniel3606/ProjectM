import { formatMinutes, formatPercent } from "./format";
import { bucketsFor, type Bucket } from "./time";
import type {
  AppUsageModel,
  DailyUsageSample,
  GrowthModel,
  MetricDelta,
  PeriodRange,
  ScreenTimeItemType,
  SeriesPoint,
  SessionAttempt,
  StatsInput,
  SummaryModel,
  SummaryStat,
  SummaryStatId,
  TrendModel,
  TrendSeries,
  UsageApp,
} from "./types";

/** Below this, a change is noise and the column reads as "no change". */
const NEGLIGIBLE_MINUTES = 1;
/** Growth is reported to one decimal, so anything under this is noise too. */
const NEGLIGIBLE_CM = 0.05;
/** How many icons the card's third column holds before it stops adding them. */
const MOST_USED_COUNT = 4;

const UP = "↑";
const DOWN = "↓";

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

function inRange(ts: number, start: number, end: number): boolean {
  return ts >= start && ts < end;
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

function samplesIn(
  usage: DailyUsageSample[],
  start: number,
  end: number
): DailyUsageSample[] {
  return usage.filter((s) => inRange(s.day, start, end));
}

function attemptsIn(
  attempts: SessionAttempt[],
  start: number,
  end: number
): SessionAttempt[] {
  return attempts.filter((a) => inRange(a.startedAt, start, end));
}

function makeDelta(
  current: number,
  previous: number | null,
  polarity: MetricDelta["polarity"],
  epsilon: number
): MetricDelta | null {
  if (previous === null) return null;

  const change = current - previous;
  const percent = previous > 0 ? change / previous : null;

  let tone: MetricDelta["tone"] = "neutral";
  if (Math.abs(change) >= epsilon) {
    const improved = polarity === "up-is-good" ? change > 0 : change < 0;
    tone = improved ? "positive" : "negative";
  }

  return { change, percent, polarity, tone };
}

/**
 * The bare "↑ 18%" the card's columns use. The period it compares against is
 * printed once on the card, so it is left off here.
 */
function changeLabel(delta: MetricDelta | null): string | null {
  if (!delta || delta.percent === null) return null;
  if (Math.round(Math.abs(delta.percent) * 100) === 0) return "No change";
  const arrow = delta.percent > 0 ? UP : DOWN;
  return `${arrow} ${formatPercent(Math.abs(delta.percent))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Growth
// ─────────────────────────────────────────────────────────────────────────────

/** Growth is only recorded on blocks that ran to completion. */
function growthIn(attempts: SessionAttempt[], start: number, end: number): number {
  return sum(
    attemptsIn(attempts, start, end).map((a) => (a.completed ? (a.growthCm ?? 0) : 0))
  );
}

/** True once any completed block in the window carries a growth figure. */
function hasGrowthData(attempts: SessionAttempt[], start: number, end: number): boolean {
  return attemptsIn(attempts, start, end).some((a) => a.growthCm !== undefined);
}

export function computeGrowth(input: StatsInput, range: PeriodRange): GrowthModel {
  const completed = attemptsIn(input.attempts, range.start, range.end).filter(
    (a) => a.completed
  );

  // Attempts recorded before growth was tracked would otherwise read as a
  // truthful-looking 0.0cm for blocks that did earn something.
  if (completed.length > 0 && !hasGrowthData(input.attempts, range.start, range.end)) {
    return {
      unavailable: "not-enough-data",
      periodCm: 0,
      display: "—",
      delta: null,
      comparison: null,
      tone: "neutral",
    };
  }

  const periodCm = growthIn(input.attempts, range.start, range.end);
  const previousCm = hasGrowthData(input.attempts, range.previousStart, range.previousEnd)
    ? growthIn(input.attempts, range.previousStart, range.previousEnd)
    : null;
  const delta = makeDelta(periodCm, previousCm, "up-is-good", NEGLIGIBLE_CM);

  return {
    unavailable: null,
    periodCm,
    display: `${periodCm.toFixed(1)}cm`,
    delta,
    comparison: withComparison(changeLabel(delta), range),
    tone: delta?.tone ?? "neutral",
  };
}

/** "↑ 18% vs yesterday" — the headline says what it is measured against. */
function withComparison(change: string | null, range: PeriodRange): string | null {
  if (!change) return null;
  if (change === "No change") return `No change vs ${range.comparisonLabel}`;
  return `${change} vs ${range.comparisonLabel}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat columns
// ─────────────────────────────────────────────────────────────────────────────

function blockedMinutesIn(
  attempts: SessionAttempt[],
  start: number,
  end: number
): number {
  return sum(attemptsIn(attempts, start, end).map((a) => a.focusedMinutes));
}

function screenMinutesIn(
  usage: DailyUsageSample[],
  start: number,
  end: number
): number {
  return sum(samplesIn(usage, start, end).map((s) => s.totalMinutes));
}

function unavailableStat(
  id: SummaryStatId,
  label: string,
  reason: NonNullable<SummaryStat["unavailable"]>
): SummaryStat {
  return {
    id,
    label,
    value: "—",
    change: null,
    tone: "neutral",
    delta: null,
    unavailable: reason,
  };
}

export function computeTimeBlocked(input: StatsInput, range: PeriodRange): SummaryStat {
  if (input.attempts.length === 0) {
    return unavailableStat("timeBlocked", "Time Blocked", "not-enough-data");
  }

  const minutes = blockedMinutesIn(input.attempts, range.start, range.end);
  const previous = blockedMinutesIn(
    input.attempts,
    range.previousStart,
    range.previousEnd
  );
  const delta = makeDelta(minutes, previous, "up-is-good", NEGLIGIBLE_MINUTES);

  return {
    id: "timeBlocked",
    label: "Time Blocked",
    value: formatMinutes(minutes),
    change: changeLabel(delta),
    tone: delta?.tone ?? "neutral",
    delta,
    unavailable: null,
  };
}

export function computeScreenTimeStat(
  input: StatsInput,
  range: PeriodRange
): SummaryStat {
  if (input.usage === null) {
    return unavailableStat("screenTime", "Screen Time", "no-source");
  }

  const samples = samplesIn(input.usage, range.start, range.end);
  if (samples.length === 0) {
    return unavailableStat("screenTime", "Screen Time", "not-enough-data");
  }

  const minutes = screenMinutesIn(input.usage, range.start, range.end);
  const previousSamples = samplesIn(
    input.usage,
    range.previousStart,
    range.previousEnd
  );
  const delta = makeDelta(
    minutes,
    previousSamples.length === 0
      ? null
      : screenMinutesIn(input.usage, range.previousStart, range.previousEnd),
    "down-is-good",
    NEGLIGIBLE_MINUTES
  );

  return {
    id: "screenTime",
    label: "Screen Time",
    value: formatMinutes(minutes),
    change: changeLabel(delta),
    tone: delta?.tone ?? "neutral",
    delta,
    unavailable: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// App usage
// ─────────────────────────────────────────────────────────────────────────────

interface AppTotal {
  appId: string;
  label: string;
  token: string | null;
  itemType: ScreenTimeItemType;
  minutes: number;
  distracting: boolean;
}

/** Totals every app across the window, keeping the first token each one offers. */
function totalByApp(samples: DailyUsageSample[]): Map<string, AppTotal> {
  const byApp = new Map<string, AppTotal>();

  for (const sample of samples) {
    for (const app of sample.apps) {
      const existing = byApp.get(app.appId);
      if (!existing) {
        byApp.set(app.appId, {
          appId: app.appId,
          label: app.label,
          token: app.token ?? null,
          itemType: app.itemType ?? "application",
          minutes: app.minutes,
          distracting: app.distracting,
        });
        continue;
      }
      existing.minutes += app.minutes;
      existing.distracting = existing.distracting || app.distracting;
      existing.token = existing.token ?? app.token ?? null;
    }
  }

  return byApp;
}

export function computeAppUsage(input: StatsInput, range: PeriodRange): AppUsageModel {
  if (input.usage === null) {
    return { unavailable: "no-source", apps: [], totalMinutes: 0 };
  }

  const samples = samplesIn(input.usage, range.start, range.end);
  if (samples.length === 0) {
    return { unavailable: "not-enough-data", apps: [], totalMinutes: 0 };
  }

  const totals = [...totalByApp(samples).values()]
    .filter((a) => a.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const previousSamples = samplesIn(
    input.usage,
    range.previousStart,
    range.previousEnd
  );
  const previous = totalByApp(previousSamples);
  // Rows are scaled against the busiest app, not the period total, so the
  // longest bar always fills its track the way the Screen Time list does.
  const peak = totals.length > 0 ? totals[0].minutes : 0;

  const apps: UsageApp[] = totals.map((app) => ({
    appId: app.appId,
    label: app.label,
    token: app.token,
    itemType: app.itemType,
    minutes: app.minutes,
    display: formatMinutes(app.minutes),
    share: peak > 0 ? app.minutes / peak : 0,
    distracting: app.distracting,
    delta:
      previousSamples.length === 0
        ? null
        : makeDelta(
            app.minutes,
            previous.get(app.appId)?.minutes ?? 0,
            "down-is-good",
            NEGLIGIBLE_MINUTES
          ),
  }));

  return {
    unavailable: apps.length === 0 ? "not-enough-data" : null,
    apps,
    totalMinutes: sum(apps.map((a) => a.minutes)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trend chart
// ─────────────────────────────────────────────────────────────────────────────

function toSeries(
  buckets: Bucket[],
  valueFor: (bucket: Bucket) => number | null
): SeriesPoint[] {
  return buckets.map((b) => ({ at: b.start, label: b.label, value: valueFor(b) }));
}

/**
 * Screen time and blocked time on one axis, so a day's two bars can be read
 * against each other. Both are minutes, which is what makes that fair.
 */
export function computeTrend(input: StatsInput, range: PeriodRange): TrendModel {
  const buckets = bucketsFor(range);
  const usage = input.usage;

  const screenTime: TrendSeries = {
    id: "screenTime",
    label: "Screen time",
    unavailable: usage === null ? "no-source" : null,
    points:
      usage === null
        ? []
        : toSeries(buckets, (bucket) => {
            const samples = samplesIn(usage, bucket.start, bucket.end);
            return samples.length === 0
              ? null
              : sum(samples.map((s) => s.totalMinutes));
          }),
  };

  const blocked: TrendSeries = {
    id: "blocked",
    label: "Time blocked",
    unavailable: input.attempts.length === 0 ? "not-enough-data" : null,
    points:
      input.attempts.length === 0
        ? []
        : toSeries(buckets, (bucket) =>
            blockedMinutesIn(input.attempts, bucket.start, bucket.end)
          ),
  };

  const series = [screenTime, blocked];

  return {
    unavailable: series.every((s) => s.unavailable !== null)
      ? (screenTime.unavailable ?? "not-enough-data")
      : null,
    series,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The card
// ─────────────────────────────────────────────────────────────────────────────

/** `appUsage` is passed in because the screen draws it as its own card too. */
export function computeSummary(
  input: StatsInput,
  range: PeriodRange,
  appUsage: AppUsageModel
): SummaryModel {
  return {
    growth: computeGrowth(input, range),
    // Today has a single bucket, so there is no shape to plot; it leads with
    // the growth headline instead.
    trend: range.id === "today" ? null : computeTrend(input, range),
    stats: [computeTimeBlocked(input, range), computeScreenTimeStat(input, range)],
    mostUsed: appUsage.apps.slice(0, MOST_USED_COUNT),
  };
}
