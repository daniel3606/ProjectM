import type { CompletedSession } from "@/contexts/FocusSessionContext";
import type { DailyUsageSample, GoalSetting, SessionAttempt } from "./types";

/**
 * Onboarding asks for a screen-time band rather than a number, so each band
 * maps to the midpoint of its range. This is the user's own answer about their
 * starting point — not a measurement — and everything derived from it is
 * labelled "before Marshmallow" rather than presented as tracked history.
 */
const BASELINE_BY_ONBOARDING_ANSWER: Record<string, number> = {
  "Less than 2 hrs/day": 90,
  "2-4 hrs/day": 180,
  "4-6 hrs/day": 300,
  "6-8 hrs/day": 420,
  "8+ hrs/day": 540,
};

export function baselineMinutesFromOnboarding(answer: string | null): number | null {
  if (!answer) return null;
  return BASELINE_BY_ONBOARDING_ANSWER[answer] ?? null;
}

/**
 * A first goal the user hasn't had to think about: a third below their stated
 * starting point, rounded to a half hour, never under an hour. Marked
 * `suggested` so the UI can say so and offer to change it.
 */
export function suggestGoalMinutes(baselineMinutesPerDay: number | null): GoalSetting | null {
  if (baselineMinutesPerDay === null) return null;
  const target = Math.max(60, Math.round((baselineMinutesPerDay * 0.67) / 30) * 30);
  return { minutesPerDay: target, suggested: true };
}

/**
 * Older installs only stored completed sessions. Those still count towards
 * totals and records, so they are folded in as completed attempts for any span
 * the attempt log doesn't already cover — without double counting the overlap.
 */
export function mergeAttemptHistory(
  attempts: SessionAttempt[],
  history: CompletedSession[]
): SessionAttempt[] {
  const earliestAttempt = attempts.reduce<number | null>(
    (min, a) => (min === null || a.startedAt < min ? a.startedAt : min),
    null
  );

  const legacy: SessionAttempt[] = history
    .filter((s) => earliestAttempt === null || s.completedAt < earliestAttempt)
    .map((s) => ({
      startedAt: s.completedAt - s.durationMinutes * 60_000,
      endedAt: s.completedAt,
      durationMinutes: s.durationMinutes,
      focusedMinutes: s.durationMinutes,
      focusMode: s.focusMode,
      completed: true,
      planId: s.planId,
      planLabel: s.label,
    }));

  return [...attempts, ...legacy].sort((a, b) => a.startedAt - b.startedAt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Device usage
//
// iOS does not expose an app's own Screen Time numbers, so no usage source is
// wired up yet. This is the seam a future one plugs into. Returning `null`
// rather than `[]` is what makes usage-backed sections say they cannot measure
// yet, instead of showing zeroes.
// ─────────────────────────────────────────────────────────────────────────────

export interface UsageSource {
  /** Daily samples covering `[start, end)`, or null when unavailable. */
  getDailyUsage(start: number, end: number): DailyUsageSample[] | null;
}

const unavailableSource: UsageSource = {
  getDailyUsage: () => null,
};

let activeSource: UsageSource = unavailableSource;

/** Swap in a real source once one exists; also used by the dev sample data. */
export function setUsageSource(source: UsageSource | null): void {
  activeSource = source ?? unavailableSource;
}

export function getUsageSource(): UsageSource {
  return activeSource;
}
