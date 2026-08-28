import type { BucketUnit, PeriodRange, StatsPeriodId } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Free accounts get Today and Week; longer history is a paid tier. */
export const FREE_PERIODS: StatsPeriodId[] = ["today", "week"];

export const PERIOD_ORDER: StatsPeriodId[] = ["today", "week", "month", "year"];

export const PERIOD_LABELS: Record<StatsPeriodId, string> = {
  today: "Today",
  week: "Week",
  month: "Month",
  year: "Year",
};

export function isPremiumPeriod(id: StatsPeriodId): boolean {
  return !FREE_PERIODS.includes(id);
}

/** Local midnight at the start of `ts`'s calendar day. */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Local midnight on the Monday of `ts`'s week. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  // getDay() is Sunday-based; shift so Monday is the first column, which is how
  // the week chart is labelled (Mon…Sun).
  const offset = (d.getDay() + 6) % 7;
  return d.getTime() - offset * DAY_MS;
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Calendar-safe day arithmetic — plain ms addition breaks across DST. */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function addMonths(ts: number, months: number): number {
  const d = new Date(ts);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/** Whole days between two timestamps, counted on calendar boundaries. */
export function dayCountBetween(start: number, end: number): number {
  return Math.max(1, Math.round((startOfDay(end) - startOfDay(start)) / DAY_MS));
}

export function weekdayLabel(ts: number): string {
  return WEEKDAY_LABELS[new Date(ts).getDay()];
}

export function monthLabel(ts: number): string {
  return MONTH_LABELS[new Date(ts).getMonth()];
}

/** The per-period parts; everything else on a `PeriodRange` is derived. */
interface PeriodShape {
  start: number;
  end: number;
  previousStart: number;
  previousEnd: number;
  bucketUnit: BucketUnit;
  comparisonLabel: string;
}

function todayShape(now: number): PeriodShape {
  const start = startOfDay(now);
  return {
    start,
    end: addDays(start, 1),
    previousStart: addDays(start, -1),
    previousEnd: start,
    bucketUnit: "hour",
    comparisonLabel: "yesterday",
  };
}

function weekShape(now: number): PeriodShape {
  const start = startOfWeek(now);
  return {
    start,
    end: addDays(start, 7),
    previousStart: addDays(start, -7),
    previousEnd: start,
    bucketUnit: "day",
    comparisonLabel: "last week",
  };
}

function monthShape(now: number): PeriodShape {
  const start = startOfMonth(now);
  return {
    start,
    end: addMonths(start, 1),
    previousStart: addMonths(start, -1),
    previousEnd: start,
    bucketUnit: "day",
    comparisonLabel: "last month",
  };
}

function yearShape(now: number): PeriodShape {
  const january = new Date(now);
  january.setMonth(0, 1);
  january.setHours(0, 0, 0, 0);
  const start = january.getTime();
  return {
    start,
    end: addMonths(start, 12),
    previousStart: addMonths(start, -12),
    previousEnd: start,
    bucketUnit: "month",
    comparisonLabel: "last year",
  };
}

const SHAPES: Record<StatsPeriodId, (now: number) => PeriodShape> = {
  today: todayShape,
  week: weekShape,
  month: monthShape,
  year: yearShape,
};

/**
 * Resolves a period id into the window it covers plus the equally sized window
 * before it. Every comparison in Stats is against that previous window, so the
 * two are derived together and never diverge.
 */
export function resolvePeriod(id: StatsPeriodId, now: number): PeriodRange {
  const shape = SHAPES[id](now);
  return {
    ...shape,
    id,
    label: PERIOD_LABELS[id],
    dayCount: dayCountBetween(shape.start, shape.end),
    requiresPremium: isPremiumPeriod(id),
  };
}

export interface Bucket {
  start: number;
  end: number;
  label: string;
}

const HOUR_MS = 60 * 60 * 1000;
/** 24 bars is noise at phone width; 8 three-hour columns read at a glance. */
const HOURS_PER_COLUMN = 3;

function hourBuckets(range: PeriodRange): Bucket[] {
  const buckets: Bucket[] = [];
  for (let hour = 0; hour < 24; hour += HOURS_PER_COLUMN) {
    const start = range.start + hour * HOUR_MS;
    buckets.push({
      start,
      end: start + HOURS_PER_COLUMN * HOUR_MS,
      // Every other column is labelled, so the ticks don't crowd.
      label: hour % (HOURS_PER_COLUMN * 2) === 0 ? formatHourTick(hour) : "",
    });
  }
  return buckets;
}

function monthBuckets(range: PeriodRange): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = range.start;
  while (cursor < range.end) {
    const next = addMonths(cursor, 1);
    buckets.push({
      start: cursor,
      end: next,
      label: new Date(cursor).getMonth() % 3 === 0 ? monthLabel(cursor) : "",
    });
    cursor = next;
  }
  return buckets;
}

/**
 * A week labels every column. Longer day-bucketed windows label the first of
 * each week plus the last column, so the axis keeps ends to read from without
 * shrinking the type.
 */
function dayBuckets(range: PeriodRange): Bucket[] {
  const total = dayCountBetween(range.start, range.end);
  const isWeek = total <= 7;
  const buckets: Bucket[] = [];
  let cursor = range.start;
  let index = 0;

  while (cursor < range.end) {
    const next = addDays(cursor, 1);
    buckets.push({
      start: cursor,
      end: next,
      label: isWeek
        ? weekdayLabel(cursor)
        : index % 7 === 0 || index === total - 1
          ? String(new Date(cursor).getDate())
          : "",
    });
    cursor = next;
    index += 1;
  }
  return buckets;
}

/** Splits a window into the buckets its chart draws. */
export function bucketsFor(range: PeriodRange): Bucket[] {
  if (range.bucketUnit === "hour") return hourBuckets(range);
  if (range.bucketUnit === "month") return monthBuckets(range);
  return dayBuckets(range);
}

function formatHourTick(hour: number): string {
  if (hour === 0) return "12a";
  if (hour === 12) return "12p";
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

/** "9 AM", "10 PM" — used for the time windows insights talk about. */
export function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24;
  const period = normalized < 12 ? "AM" : "PM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display} ${period}`;
}

/** "9 AM – 11 AM". Midnight reads as "12 AM" on both ends of a wrap. */
export function formatHourWindow(startHour: number, endHour: number): string {
  return `${formatHour(startHour)} – ${formatHour(endHour)}`;
}

export function bucketUnitToDays(unit: BucketUnit): number {
  switch (unit) {
    case "hour":
      return 1 / 8;
    case "day":
      return 1;
    case "week":
      return 7;
    case "month":
      return 30;
  }
}

/** "Today", "This week" — how a period is referred to in body copy. */
export function periodCaption(id: StatsPeriodId): string {
  return id === "today" ? "Today" : `This ${PERIOD_LABELS[id].toLowerCase()}`;
}
