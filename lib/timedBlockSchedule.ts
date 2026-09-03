import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";

export interface PlanOccurrence {
  plan: TimedBlockPlan;
  startsAt: number;
  endsAt: number;
}

/** When a run really starts blocking, and for how long. */
export interface OccurrenceRun {
  /** Later than the occurrence's own start when the window was joined late. */
  startedAt: number;
  /** Minutes this run really blocks for. Growth is priced on this. */
  durationMinutes: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Finds the enabled plan (if any) whose weekly window contains `now`.
 * Walks back a full week so an overnight block that started yesterday and
 * is still running (end time past midnight) is still matched today.
 */
export function findActiveOccurrence(
  plans: TimedBlockPlan[],
  now: number = Date.now()
): PlanOccurrence | null {
  for (const plan of plans) {
    const occurrence = liveOccurrenceForPlan(plan, now);
    if (occurrence) return occurrence;
  }
  return null;
}

/**
 * The window of one named plan that contains `now`, or null. A caller holding
 * a plan id needs to know whether that plan is live, not whether some other
 * plan's window happens to overlap.
 */
export function findPlanOccurrence(
  plans: TimedBlockPlan[],
  planId: string,
  now: number = Date.now()
): PlanOccurrence | null {
  const plan = plans.find((p) => p.id === planId);
  return plan ? liveOccurrenceForPlan(plan, now) : null;
}

/** Stable key for one run of one plan, used to remember a manual stop. */
export function occurrenceKey(planId: string, startsAt: number): string {
  return `${planId}-${startsAt}`;
}

/**
 * Whether `plan` still schedules the run that started at `startsAt`.
 *
 * A run keeps its own clock once started, so this asks only whether the plan
 * behind it still stands: turning it off, deleting it or moving it to another
 * time withdraws the run, changing its length does not.
 */
export function planSchedulesRun(plan: TimedBlockPlan, startsAt: number): boolean {
  if (!plan.enabled) return false;

  const start = new Date(startsAt);
  return (
    plan.daysOfWeek.includes(start.getDay()) &&
    start.getHours() === plan.startHour &&
    start.getMinutes() === plan.startMinute
  );
}

/**
 * The session parameters for `occurrence` given that blocking really begins at
 * `blockedFrom` — now, for a window joined part-way through; the extension's
 * start time, for a block adopted after the fact.
 *
 * The run ends when the window does, so joining late shortens the block rather
 * than extending it and the growth it earns covers only the minutes actually
 * blocked. Returns null under half a minute left, which rounds to no block.
 */
export function occurrenceRun(
  occurrence: PlanOccurrence,
  blockedFrom: number
): OccurrenceRun | null {
  const from = Math.min(Math.max(blockedFrom, occurrence.startsAt), occurrence.endsAt);
  const durationMinutes = Math.round((occurrence.endsAt - from) / 60_000);
  if (durationMinutes < 1) return null;

  // Anchored to the window's end so `startedAt + durationMinutes` still lands
  // exactly there after rounding.
  return { startedAt: occurrence.endsAt - durationMinutes * 60_000, durationMinutes };
}

/** The window a plan is currently inside. A disabled plan is never inside one. */
function liveOccurrenceForPlan(plan: TimedBlockPlan, now: number): PlanOccurrence | null {
  if (!plan.enabled) return null;

  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    const day = new Date(now - daysAgo * DAY_MS);
    if (!plan.daysOfWeek.includes(day.getDay())) continue;

    day.setHours(plan.startHour, plan.startMinute, 0, 0);
    const startsAt = day.getTime();
    const endsAt = startsAt + plan.durationMinutes * 60_000;

    if (now >= startsAt && now < endsAt) {
      return { plan, startsAt, endsAt };
    }
  }
  return null;
}
