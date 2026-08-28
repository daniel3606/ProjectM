import {
  formatComparison,
  formatGain,
  formatMinutes,
  formatPerDay,
  formatPercent,
} from "./format";
import { bucketsFor, resolvePeriod, startOfDay, type Bucket } from "./time";
import type {
  DailyUsageSample,
  DistractingApp,
  DistractionsModel,
  FocusModel,
  GoalModel,
  MetricDelta,
  OverviewMetric,
  OverviewModel,
  PeriodRange,
  ReclaimedModel,
  ScreenTimeModel,
  SeriesPoint,
  SessionAttempt,
  SessionsModel,
  StatsInput,
  StatsModel,
  StatsPeriodId,
} from "./types";
import { computeInsights, computeRecommendation } from "./insights";
import { computeRecords } from "./records";

/** Below this, a change is noise and the UI says "no change" rather than picking a direction. */
const NEGLIGIBLE_MINUTES = 1;

/** How much history the screen needs before it stops leading with onboarding copy. */
const NEW_USER_ATTEMPT_THRESHOLD = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

export function makeDelta(
  current: number,
  previous: number | null,
  polarity: MetricDelta["polarity"],
  epsilon: number = NEGLIGIBLE_MINUTES
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

function inRange(ts: number, start: number, end: number): boolean {
  return ts >= start && ts < end;
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

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

/**
 * Buckets values into a chart series. Buckets with no underlying data stay
 * `null` so the chart can leave a gap rather than draw a misleading zero —
 * "you didn't focus" and "we weren't measuring" are different statements.
 */
function toSeries(
  buckets: Bucket[],
  valueFor: (bucket: Bucket) => number | null
): SeriesPoint[] {
  return buckets.map((b) => ({ at: b.start, label: b.label, value: valueFor(b) }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen time
// ─────────────────────────────────────────────────────────────────────────────

/** Per-day average over the days we actually have samples for, not the calendar span. */
function averagePerMeasuredDay(usage: DailyUsageSample[], start: number, end: number): number {
  const samples = samplesIn(usage, start, end);
  if (samples.length === 0) return 0;
  return sum(samples.map((s) => s.totalMinutes)) / samples.length;
}

export function computeScreenTime(
  input: StatsInput,
  range: PeriodRange,
  buckets: Bucket[]
): ScreenTimeModel {
  const empty: ScreenTimeModel = {
    unavailable: "no-source",
    series: [],
    references: [],
    averageMinutesPerDay: 0,
    delta: null,
    interpretation: null,
  };

  if (input.usage === null) return empty;

  const samples = samplesIn(input.usage, range.start, range.end);
  if (samples.length === 0) {
    return { ...empty, unavailable: "not-enough-data" };
  }

  const series = toSeries(buckets, (b) => {
    const inBucket = samplesIn(input.usage!, b.start, b.end);
    return inBucket.length === 0 ? null : sum(inBucket.map((s) => s.totalMinutes));
  });

  const average = averagePerMeasuredDay(input.usage, range.start, range.end);
  const previousSamples = samplesIn(input.usage, range.previousStart, range.previousEnd);
  const previousAverage =
    previousSamples.length === 0
      ? null
      : averagePerMeasuredDay(input.usage, range.previousStart, range.previousEnd);

  const delta = makeDelta(average, previousAverage, "down-is-good");

  const references: ScreenTimeModel["references"] = [];
  if (input.goal) {
    references.push({
      value: input.goal.minutesPerDay,
      label: `Goal · ${formatMinutes(input.goal.minutesPerDay)}`,
      style: "goal",
    });
  }
  if (input.baselineMinutesPerDay !== null) {
    references.push({
      value: input.baselineMinutesPerDay,
      label: `Before Marshmallow · ${formatMinutes(input.baselineMinutesPerDay)}`,
      style: "baseline",
    });
  }

  return {
    unavailable: null,
    series,
    references,
    averageMinutesPerDay: average,
    delta,
    interpretation: screenTimeInterpretation(average, input.baselineMinutesPerDay, delta, range),
  };
}

function screenTimeInterpretation(
  average: number,
  baseline: number | null,
  delta: MetricDelta | null,
  range: PeriodRange
): string {
  if (baseline !== null && baseline - average >= NEGLIGIBLE_MINUTES) {
    return `You're using your phone ${formatMinutes(baseline - average)} less per day than when you started.`;
  }
  if (delta && delta.tone === "positive") {
    return `You're down ${formatMinutes(Math.abs(delta.change))} a day on ${range.comparisonLabel}.`;
  }
  if (delta && delta.tone === "negative") {
    return `A little higher than ${range.comparisonLabel} — ${formatMinutes(Math.abs(delta.change))} more per day.`;
  }
  return `You're averaging ${formatPerDay(average)}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus
// ─────────────────────────────────────────────────────────────────────────────

function focusedMinutesIn(attempts: SessionAttempt[], start: number, end: number): number {
  return sum(attemptsIn(attempts, start, end).map((a) => a.focusedMinutes));
}

export function computeFocus(
  input: StatsInput,
  range: PeriodRange,
  buckets: Bucket[]
): FocusModel {
  const windowAttempts = attemptsIn(input.attempts, range.start, range.end);

  if (windowAttempts.length === 0) {
    return {
      unavailable: "not-enough-data",
      series: [],
      totalMinutes: 0,
      averageMinutesPerDay: 0,
      delta: null,
      interpretation: null,
    };
  }

  // Focus is a count of things the user did, so an empty bucket genuinely is a
  // zero — unlike screen time, where an empty bucket means "unmeasured".
  const series = toSeries(buckets, (b) => focusedMinutesIn(input.attempts, b.start, b.end));

  const total = sum(windowAttempts.map((a) => a.focusedMinutes));
  const previousTotal = focusedMinutesIn(input.attempts, range.previousStart, range.previousEnd);
  const hadPreviousWindow = attemptsIn(
    input.attempts,
    range.previousStart,
    range.previousEnd
  ).length > 0;

  const delta = makeDelta(total, hadPreviousWindow ? previousTotal : null, "up-is-good");
  const average = total / range.dayCount;
  const activeDays = new Set(windowAttempts.map((a) => startOfDay(a.startedAt))).size;

  return {
    unavailable: null,
    series,
    totalMinutes: total,
    averageMinutesPerDay: average,
    delta,
    interpretation: focusInterpretation(total, activeDays, delta, range),
  };
}

/**
 * The average per day is already on screen next to the total, so this line
 * never repeats it. A quieter period is stated as a fact, not a shortfall.
 */
function focusInterpretation(
  total: number,
  activeDays: number,
  delta: MetricDelta | null,
  range: PeriodRange
): string {
  if (delta && delta.percent !== null && delta.tone === "positive") {
    return `You focused ${formatPercent(Math.abs(delta.percent))} more than ${range.comparisonLabel}.`;
  }
  if (delta && delta.tone === "negative") {
    return `A quieter stretch than ${range.comparisonLabel}, by ${formatMinutes(Math.abs(delta.change))}.`;
  }
  if (delta) {
    return `About the same as ${range.comparisonLabel}.`;
  }
  if (range.dayCount > 1) {
    return `You focused on ${activeDays} of ${range.dayCount} days.`;
  }
  return `${formatMinutes(total)} of focused time so far today.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Time reclaimed
// ─────────────────────────────────────────────────────────────────────────────

/** Minutes spent under the baseline, summed per day. Never negative. */
function reclaimedBelowBaseline(
  usage: DailyUsageSample[],
  baseline: number,
  start: number,
  end: number
): number {
  return sum(
    samplesIn(usage, start, end).map((s) => Math.max(0, baseline - s.totalMinutes))
  );
}

export function computeReclaimed(input: StatsInput, range: PeriodRange): ReclaimedModel {
  const lifetimeStart = input.joinedAt ?? -Infinity;
  const canUseBaseline = input.usage !== null && input.baselineMinutesPerDay !== null;

  if (canUseBaseline) {
    const usage = input.usage!;
    const baseline = input.baselineMinutesPerDay!;
    const period = reclaimedBelowBaseline(usage, baseline, range.start, range.end);
    const previousHasData = samplesIn(usage, range.previousStart, range.previousEnd).length > 0;
    const previous = previousHasData
      ? reclaimedBelowBaseline(usage, baseline, range.previousStart, range.previousEnd)
      : null;
    const lifetime = reclaimedBelowBaseline(usage, baseline, lifetimeStart, Number.MAX_SAFE_INTEGER);

    if (samplesIn(usage, range.start, range.end).length === 0) {
      return emptyReclaimed("not-enough-data", "below-baseline");
    }

    const delta = makeDelta(period, previous, "up-is-good");
    return {
      unavailable: null,
      basis: "below-baseline",
      periodMinutes: period,
      lifetimeMinutes: lifetime,
      delta,
      interpretation: reclaimedInterpretation(lifetime, "below-baseline"),
    };
  }

  const period = focusedMinutesIn(input.attempts, range.start, range.end);
  if (input.attempts.length === 0) {
    return emptyReclaimed("not-enough-data", "blocked-time");
  }

  const hadPrevious =
    attemptsIn(input.attempts, range.previousStart, range.previousEnd).length > 0;
  const previous = hadPrevious
    ? focusedMinutesIn(input.attempts, range.previousStart, range.previousEnd)
    : null;
  const lifetime = sum(input.attempts.map((a) => a.focusedMinutes));

  return {
    unavailable: period === 0 && lifetime === 0 ? "not-enough-data" : null,
    basis: "blocked-time",
    periodMinutes: period,
    lifetimeMinutes: lifetime,
    delta: makeDelta(period, previous, "up-is-good"),
    interpretation: reclaimedInterpretation(lifetime, "blocked-time"),
  };
}

function emptyReclaimed(
  unavailable: ReclaimedModel["unavailable"],
  basis: ReclaimedModel["basis"]
): ReclaimedModel {
  return {
    unavailable,
    basis,
    periodMinutes: 0,
    lifetimeMinutes: 0,
    delta: null,
    interpretation: null,
  };
}

/** Converts the lifetime total to whole days; never repeats the figure shown above it. */
function reclaimedInterpretation(
  lifetimeMinutes: number,
  basis: ReclaimedModel["basis"]
): string | null {
  const days = lifetimeMinutes / (60 * 24);

  if (days >= 1) {
    const whole = Math.floor(days);
    const fraction = days - whole;
    if (fraction >= 0.85) {
      return `You've gotten nearly ${spell(whole + 1)} full days back.`;
    }
    return whole === 1
      ? "You've gotten a full day back."
      : `You've gotten more than ${spell(whole)} full days back.`;
  }
  if (lifetimeMinutes > 0) {
    return basis === "blocked-time"
      ? "Every block you finish adds to this."
      : "This grows every day you stay under your starting point.";
  }
  return null;
}

const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];

/** Small counts read better as words in a sentence than as digits. */
function spell(count: number): string {
  return NUMBER_WORDS[count] ?? String(count);
}

// ─────────────────────────────────────────────────────────────────────────────
// Distractions
// ─────────────────────────────────────────────────────────────────────────────

function blockedMinutesForApp(
  attempts: SessionAttempt[],
  appId: string,
  start: number,
  end: number
): number {
  return sum(
    attemptsIn(attempts, start, end)
      .filter((a) => !a.appIds || a.appIds.length === 0 || a.appIds.includes(appId))
      .map((a) => a.focusedMinutes)
  );
}

export function computeDistractions(input: StatsInput, range: PeriodRange): DistractionsModel {
  if (input.usage === null) {
    return { unavailable: "no-source", apps: [], totalMinutes: 0 };
  }

  const samples = samplesIn(input.usage, range.start, range.end);
  if (samples.length === 0) {
    return { unavailable: "not-enough-data", apps: [], totalMinutes: 0 };
  }

  const current = aggregateApps(samples);
  const previousSamples = samplesIn(input.usage, range.previousStart, range.previousEnd);
  const previous = aggregateApps(previousSamples);
  const measuredDays = samples.length;

  const apps: DistractingApp[] = [...current.values()]
    .filter((a) => a.distracting && a.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
    .map((a) => ({
      appId: a.appId,
      label: a.label,
      minutes: a.minutes,
      averageMinutesPerDay: a.minutes / measuredDays,
      delta:
        previousSamples.length === 0
          ? null
          : makeDelta(a.minutes, previous.get(a.appId)?.minutes ?? 0, "down-is-good"),
      peakHour: a.peakHour,
      blockedMinutes: blockedMinutesForApp(input.attempts, a.appId, range.start, range.end),
    }));

  return {
    unavailable: apps.length === 0 ? "not-enough-data" : null,
    apps,
    totalMinutes: sum(apps.map((a) => a.minutes)),
  };
}

interface AppAggregate {
  appId: string;
  label: string;
  minutes: number;
  distracting: boolean;
  peakHour: number | null;
  hourly: number[] | null;
}

function aggregateApps(samples: DailyUsageSample[]): Map<string, AppAggregate> {
  const byApp = new Map<string, AppAggregate>();

  for (const sample of samples) {
    for (const app of sample.apps) {
      const existing = byApp.get(app.appId);
      if (existing) {
        existing.minutes += app.minutes;
        existing.distracting = existing.distracting || app.distracting;
      } else {
        byApp.set(app.appId, {
          appId: app.appId,
          label: app.label,
          minutes: app.minutes,
          distracting: app.distracting,
          peakHour: null,
          hourly: null,
        });
      }
    }
  }

  // Peak hour is only known at the day level, so every app in a day shares that
  // day's busiest distracting hour. It's reported as the window the user is
  // most exposed, not as a per-app measurement.
  const hourly = totalHourlyDistracting(samples);
  if (hourly) {
    const peak = hourly.indexOf(Math.max(...hourly));
    for (const agg of byApp.values()) {
      if (agg.distracting) agg.peakHour = peak;
    }
  }

  return byApp;
}

export function totalHourlyDistracting(samples: DailyUsageSample[]): number[] | null {
  const withHourly = samples.filter((s) => s.hourlyDistractingMinutes?.length === 24);
  if (withHourly.length === 0) return null;

  const totals = new Array(24).fill(0) as number[];
  for (const sample of withHourly) {
    sample.hourlyDistractingMinutes!.forEach((minutes, hour) => {
      totals[hour] += minutes;
    });
  }
  return totals;
}

// ─────────────────────────────────────────────────────────────────────────────
// Goal
// ─────────────────────────────────────────────────────────────────────────────

export function computeGoal(input: StatsInput, range: PeriodRange): GoalModel {
  const target = input.goal?.minutesPerDay ?? 0;

  const empty: GoalModel = {
    unavailable: input.goal === null ? "not-enough-data" : "no-source",
    targetMinutesPerDay: target,
    currentMinutesPerDay: 0,
    progress: 0,
    differenceMinutes: 0,
    suggested: input.goal?.suggested ?? false,
    interpretation: "",
  };

  if (input.goal === null) return empty;
  if (input.usage === null) return empty;

  const samples = samplesIn(input.usage, range.start, range.end);
  if (samples.length === 0) return { ...empty, unavailable: "not-enough-data" };

  const current = averagePerMeasuredDay(input.usage, range.start, range.end);
  const difference = current - target;

  // Progress runs from the user's starting point down to the target, so a bar
  // that's filling means "closing the gap" rather than "spending budget".
  const from = input.baselineMinutesPerDay ?? Math.max(target * 2, current);
  const span = Math.max(1, from - target);
  const progress = Math.max(0, Math.min(1, (from - current) / span));

  return {
    unavailable: null,
    targetMinutesPerDay: target,
    currentMinutesPerDay: current,
    progress,
    differenceMinutes: difference,
    suggested: input.goal.suggested,
    interpretation: goalInterpretation(difference, range),
  };
}

function goalInterpretation(difference: number, range: PeriodRange): string {
  const unit = range.id === "today" ? "today" : "on average";
  if (Math.abs(difference) < NEGLIGIBLE_MINUTES) {
    return `Right on your goal ${unit}.`;
  }
  if (difference > 0) {
    return `${formatMinutes(difference)} above your goal ${unit}.`;
  }
  return `${formatMinutes(-difference)} under your goal ${unit}.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions
// ─────────────────────────────────────────────────────────────────────────────

export function computeSessions(input: StatsInput, range: PeriodRange): SessionsModel {
  const windowAttempts = attemptsIn(input.attempts, range.start, range.end);

  if (windowAttempts.length === 0) {
    return {
      unavailable: "not-enough-data",
      started: 0,
      completed: 0,
      completionRate: 0,
      totalFocusedMinutes: 0,
      averageSessionMinutes: 0,
      longestSessionMinutes: 0,
    };
  }

  const completed = windowAttempts.filter((a) => a.completed);
  const totalFocused = sum(windowAttempts.map((a) => a.focusedMinutes));

  return {
    unavailable: null,
    started: windowAttempts.length,
    completed: completed.length,
    completionRate: completed.length / windowAttempts.length,
    totalFocusedMinutes: totalFocused,
    averageSessionMinutes: totalFocused / windowAttempts.length,
    longestSessionMinutes: Math.max(...windowAttempts.map((a) => a.focusedMinutes)),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview
// ─────────────────────────────────────────────────────────────────────────────

function metric(
  id: OverviewMetric["id"],
  label: string,
  value: string,
  comparison: string | null,
  delta: MetricDelta | null,
  extras: { caption?: string; unavailable?: OverviewMetric["unavailable"] } = {}
): OverviewMetric {
  return {
    id,
    label,
    value,
    comparison,
    tone: delta?.tone ?? "neutral",
    caption: extras.caption,
    unavailable: extras.unavailable ?? null,
  };
}

export function computeOverview(
  range: PeriodRange,
  focus: FocusModel,
  screenTime: ScreenTimeModel,
  reclaimed: ReclaimedModel,
  sessions: SessionsModel
): OverviewModel {
  const hero = metric(
    "focus",
    "Focused Time",
    focus.unavailable ? "—" : formatMinutes(focus.totalMinutes),
    formatComparison(focus.delta, range.comparisonLabel),
    focus.delta,
    { unavailable: focus.unavailable }
  );

  const screenTimeMetric = metric(
    "screenTime",
    "Screen Time",
    screenTime.unavailable ? "—" : formatPerDay(screenTime.averageMinutesPerDay),
    formatComparison(screenTime.delta, range.comparisonLabel, { unit: "minutesPerDay" }),
    screenTime.delta,
    { unavailable: screenTime.unavailable }
  );

  const reclaimedMetric = metric(
    "reclaimed",
    "Time Reclaimed",
    reclaimed.unavailable ? "—" : formatMinutes(reclaimed.periodMinutes),
    formatGain(reclaimed.delta, range.comparisonLabel),
    reclaimed.delta,
    { unavailable: reclaimed.unavailable }
  );

  const sessionsMetric = metric(
    "sessions",
    "Sessions",
    sessions.unavailable ? "—" : `${sessions.completed} / ${sessions.started}`,
    null,
    null,
    {
      caption: sessions.unavailable
        ? undefined
        : `${formatPercent(sessions.completionRate)} completion`,
      unavailable: sessions.unavailable,
    }
  );

  return { hero, supporting: [screenTimeMetric, reclaimedMetric, sessionsMetric] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

export function computeStats(input: StatsInput, periodId: StatsPeriodId): StatsModel {
  const range = resolvePeriod(periodId, input.now);
  const periodLocked = range.requiresPremium && !input.isPremium;
  const buckets = bucketsFor(range);

  const screenTime = computeScreenTime(input, range, buckets);
  const focus = computeFocus(input, range, buckets);
  const reclaimed = computeReclaimed(input, range);
  const distractions = computeDistractions(input, range);
  const goal = computeGoal(input, range);
  const sessions = computeSessions(input, range);
  const records = computeRecords(input);
  const insights = computeInsights(input, range);
  const recommendation = computeRecommendation(input, range, insights.insights);

  return {
    period: range,
    periodLocked,
    overview: computeOverview(range, focus, screenTime, reclaimed, sessions),
    screenTime,
    focus,
    reclaimed,
    distractions,
    goal,
    sessions,
    records,
    insights,
    recommendation,
    isNewUser:
      input.attempts.length < NEW_USER_ATTEMPT_THRESHOLD &&
      (input.usage === null || input.usage.length < 3),
  };
}
