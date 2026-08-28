/**
 * Screen-time arithmetic and copy for the onboarding flow.
 *
 * Both time screens work in whole minutes snapped to `SCREEN_TIME_STEP_MINUTES`,
 * which is also the increment that earns a haptic tick — so the value the user
 * feels and the value we store are always the same thing.
 */

export const MIN_SCREEN_TIME_MINUTES = 30;
export const MAX_SCREEN_TIME_MINUTES = 12 * 60;
export const SCREEN_TIME_STEP_MINUTES = 15;

/**
 * Current usage stops a step above the floor so there is always room for a goal
 * underneath it. Sitting on the floor itself collapses the goal ceiling onto the
 * current value, and then the reclaimed screen has nothing to report.
 */
export const MIN_CURRENT_MINUTES = MIN_SCREEN_TIME_MINUTES + SCREEN_TIME_STEP_MINUTES;

/** Default anchor on the current-usage screen: a plausible middle, not a judgement. */
export const DEFAULT_CURRENT_MINUTES = 5 * 60;

const DAYS_PER_WEEK = 7;
const DAYS_PER_YEAR = 365;
const MINUTES_PER_DAY = 24 * 60;

/**
 * The age the lifetime arithmetic counts towards. Deliberately a round,
 * conservative figure rather than an actuarial table: the point of the number
 * on screen is the scale of the loss, and a decimal place of life expectancy
 * would not change what anyone does about it.
 */
export const LIFE_EXPECTANCY_YEARS = 80;

/** Nobody is shown a horizon shorter than this, however old they say they are. */
const MIN_REMAINING_YEARS = 15;

/** How close to a whole number counts as "exactly" that number in copy. */
const ROUNDING_TOLERANCE_HOURS = 0.15;

export function clampScreenTime(minutes: number): number {
  return Math.min(MAX_SCREEN_TIME_MINUTES, Math.max(MIN_SCREEN_TIME_MINUTES, minutes));
}

/** Snaps to the nearest step and clamps, so every stored value is a value the UI can display. */
export function snapScreenTime(minutes: number): number {
  const snapped = Math.round(minutes / SCREEN_TIME_STEP_MINUTES) * SCREEN_TIME_STEP_MINUTES;
  return clampScreenTime(snapped);
}

/** "6h 20m", "3h", "45m" — the format used everywhere the user sees a duration. */
export function formatScreenTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * A goal that reads as ambitious but reachable: a little over half of current
 * usage, never above what the user just told us they spend.
 */
export function suggestTargetMinutes(currentMinutes: number): number {
  const current = snapScreenTime(currentMinutes);
  const suggested = snapScreenTime(current * 0.55);
  return Math.min(suggested, maxTargetMinutes(current));
}

/**
 * The highest goal we'll accept for a given current usage. A goal at or above
 * current usage reclaims nothing, so the goal slider stops one step short
 * rather than warning the user about a number they can't act on.
 */
export function maxTargetMinutes(currentMinutes: number): number {
  return Math.max(
    MIN_SCREEN_TIME_MINUTES,
    snapScreenTime(currentMinutes) - SCREEN_TIME_STEP_MINUTES
  );
}

export interface ReclaimedTime {
  /** Minutes per day the goal frees up. Never negative. */
  dailyMinutes: number;
  weeklyMinutes: number;
  /** Rounded to the nearest 10 hours — precision here would be false. */
  yearlyHours: number;
}

export function computeReclaimedTime(
  currentMinutes: number,
  targetMinutes: number
): ReclaimedTime {
  const dailyMinutes = Math.max(0, Math.round(currentMinutes - targetMinutes));
  const yearlyHoursExact = (dailyMinutes * DAYS_PER_YEAR) / 60;

  return {
    dailyMinutes,
    weeklyMinutes: dailyMinutes * DAYS_PER_WEEK,
    yearlyHours: Math.round(yearlyHoursExact / 10) * 10,
  };
}

function pluralHours(count: number): string {
  return count === 1 ? "1 hour" : `${count} hours`;
}

/**
 * Approximates a weekly total the way a person would say it out loud:
 * "Nearly 20 hours" when it's just short, "Over 20 hours" when it's just past.
 */
export function describeWeekly(dailyMinutes: number): string {
  const weeklyMinutes = Math.max(0, dailyMinutes) * DAYS_PER_WEEK;
  const weeklyHours = weeklyMinutes / 60;

  // Under an hour there's no hour count to round to, and rounding up to one
  // would promise time the user isn't actually getting back.
  if (weeklyHours < 1) return `${formatScreenTime(weeklyMinutes)} every week.`;

  const rounded = Math.round(weeklyHours);
  const drift = weeklyHours - rounded;

  if (Math.abs(drift) <= ROUNDING_TOLERANCE_HOURS) {
    return `${pluralHours(rounded)} every week.`;
  }
  return drift < 0
    ? `Nearly ${pluralHours(rounded)} every week.`
    : `Over ${pluralHours(rounded)} every week.`;
}

export function describeYearly(dailyMinutes: number): string {
  const { yearlyHours } = computeReclaimedTime(dailyMinutes, 0);
  return `Around ${yearlyHours.toLocaleString("en-US")} hours a year.`;
}

/** How much life is left to spend, from the middle of the age band they picked. */
export function remainingYearsFrom(midpointAge: number): number {
  return Math.max(MIN_REMAINING_YEARS, LIFE_EXPECTANCY_YEARS - midpointAge);
}

export interface LifetimeScreenTime {
  /** Whole days a year the current habit costs, at today's pace. */
  daysPerYear: number;
  /** The horizon the two year figures are measured over. */
  remainingYears: number;
  /** Years of the life ahead of them spent looking at a phone. */
  yearsLost: number;
  /** Years of that the goal hands back. */
  yearsReclaimed: number;
}

/**
 * The same daily habit, restated at the scale of a life.
 *
 * Minutes a day is a number people have already made peace with. Years is the
 * same fact at a size that is harder to wave away, which is the only reason
 * this screen exists.
 */
export function computeLifetimeScreenTime(
  currentMinutes: number,
  reclaimedDailyMinutes: number,
  remainingYears: number
): LifetimeScreenTime {
  const daily = Math.max(0, currentMinutes);
  const reclaimed = Math.max(0, Math.min(reclaimedDailyMinutes, daily));
  const years = Math.max(0, remainingYears);

  return {
    daysPerYear: Math.round((daily * DAYS_PER_YEAR) / MINUTES_PER_DAY),
    remainingYears: years,
    yearsLost: (daily * years) / MINUTES_PER_DAY,
    yearsReclaimed: (reclaimed * years) / MINUTES_PER_DAY,
  };
}

/**
 * Years at the precision they can carry. A decimal is the difference between
 * two real answers when the number is small, and false confidence once it
 * reaches double figures.
 */
export function formatYears(years: number): string {
  const safe = Math.max(0, years);
  if (safe >= 10) return String(Math.round(safe));
  const rounded = Math.round(safe * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "1 year" / "6.5 years", for copy that has to read aloud correctly. */
export function describeYears(years: number): string {
  const formatted = formatYears(years);
  return `${formatted} ${formatted === "1" ? "year" : "years"}`;
}
