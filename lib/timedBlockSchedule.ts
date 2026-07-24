import type { TimedBlockPlan } from "@/contexts/TimedBlockPlansContext";

export interface PlanOccurrence {
  plan: TimedBlockPlan;
  startsAt: number;
  endsAt: number;
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
    if (!plan.enabled) continue;
    const occurrence = occurrenceForPlan(plan, now);
    if (occurrence) return occurrence;
  }
  return null;
}

function occurrenceForPlan(plan: TimedBlockPlan, now: number): PlanOccurrence | null {
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
