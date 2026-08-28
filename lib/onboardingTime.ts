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
