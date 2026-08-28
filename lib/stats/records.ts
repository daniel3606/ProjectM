import { formatMinutes, formatPerDay } from "./format";
import { startOfDay, startOfWeek, addDays, DAY_MS } from "./time";
import type {
  DailyUsageSample,
  PersonalBest,
  PersonalBestId,
  PersonalBestRecord,
  RecordsModel,
  SessionAttempt,
  StatsInput,
} from "./types";

const LABELS: Record<PersonalBestId, string> = {
  longestSession: "Longest Focus Session",
  mostFocusedDay: "Most Focused Day",
  bestWeek: "Best Week",
  lowestScreenTime: "Lowest Screen Time",
  mostTimeReclaimed: "Most Time Reclaimed",
};

/** Bests where a smaller number is the better one. */
const LOWER_IS_BETTER: PersonalBestId[] = ["lowestScreenTime"];

/** Bests measured as a daily rate rather than a total. */
const PER_DAY: PersonalBestId[] = ["lowestScreenTime", "mostTimeReclaimed"];

interface Candidate {
  id: PersonalBestId;
  /** Best value observed across all history, or null when never achieved. */
  value: number | null;
  achievedAt: number | null;
}

function groupBy<T>(items: T[], key: (item: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function bestOf(
  entries: { value: number; at: number }[],
  lowerIsBetter: boolean
): { value: number; at: number } | null {
  if (entries.length === 0) return null;
  return entries.reduce((best, entry) =>
    lowerIsBetter
      ? entry.value < best.value
        ? entry
        : best
      : entry.value > best.value
        ? entry
        : best
  );
}

function focusCandidates(attempts: SessionAttempt[]): Candidate[] {
  const completed = attempts.filter((a) => a.completed && a.focusedMinutes > 0);

  const longest = bestOf(
    completed.map((a) => ({ value: a.focusedMinutes, at: a.endedAt })),
    false
  );

  const byDay = groupBy(completed, (a) => startOfDay(a.startedAt));
  const bestDay = bestOf(
    [...byDay.entries()].map(([day, list]) => ({
      value: list.reduce((s, a) => s + a.focusedMinutes, 0),
      at: day,
    })),
    false
  );

  const byWeek = groupBy(completed, (a) => startOfWeek(a.startedAt));
  const bestWeek = bestOf(
    [...byWeek.entries()].map(([week, list]) => ({
      value: list.reduce((s, a) => s + a.focusedMinutes, 0),
      at: week,
    })),
    false
  );

  return [
    { id: "longestSession", value: longest?.value ?? null, achievedAt: longest?.at ?? null },
    { id: "mostFocusedDay", value: bestDay?.value ?? null, achievedAt: bestDay?.at ?? null },
    { id: "bestWeek", value: bestWeek?.value ?? null, achievedAt: bestWeek?.at ?? null },
  ];
}

function usageCandidates(
  usage: DailyUsageSample[] | null,
  baseline: number | null
): Candidate[] {
  if (usage === null || usage.length === 0) {
    return [
      { id: "lowestScreenTime", value: null, achievedAt: null },
      { id: "mostTimeReclaimed", value: null, achievedAt: null },
    ];
  }

  // The current day is still accumulating, so it can't hold a "lowest screen
  // time" record it might lose by bedtime.
  const settled = usage.filter((s) => s.day < startOfDay(Date.now()));
  const pool = settled.length > 0 ? settled : [];

  const lowest = bestOf(
    pool.map((s) => ({ value: s.totalMinutes, at: s.day })),
    true
  );

  const reclaimed =
    baseline === null
      ? null
      : bestOf(
          pool.map((s) => ({ value: Math.max(0, baseline - s.totalMinutes), at: s.day })),
          false
        );

  return [
    { id: "lowestScreenTime", value: lowest?.value ?? null, achievedAt: lowest?.at ?? null },
    {
      id: "mostTimeReclaimed",
      value: reclaimed && reclaimed.value > 0 ? reclaimed.value : null,
      achievedAt: reclaimed && reclaimed.value > 0 ? reclaimed.at : null,
    },
  ];
}

/**
 * A best counts as new when it beats what was last acknowledged. Records the
 * user has already been shown carry `seen`, which is what stops the reveal
 * animation and its haptic from firing again on every visit.
 */
function isNewlySet(candidate: Candidate, stored: PersonalBestRecord | undefined): boolean {
  if (candidate.value === null) return false;
  if (!stored) return true;
  if (stored.seen === false) return true;

  const improved = LOWER_IS_BETTER.includes(candidate.id)
    ? candidate.value < stored.value
    : candidate.value > stored.value;
  return improved;
}

export function computeRecords(input: StatsInput): RecordsModel {
  const storedById = new Map(input.personalBests.map((r) => [r.id, r]));
  const candidates = [
    ...focusCandidates(input.attempts),
    ...usageCandidates(input.usage, input.baselineMinutesPerDay),
  ];

  const bests: PersonalBest[] = candidates.map((candidate) => {
    const stored = storedById.get(candidate.id);
    const usageBacked =
      candidate.id === "lowestScreenTime" || candidate.id === "mostTimeReclaimed";

    return {
      id: candidate.id,
      label: LABELS[candidate.id],
      value: candidate.value ?? 0,
      display:
        candidate.value === null
          ? null
          : PER_DAY.includes(candidate.id)
            ? formatPerDay(candidate.value)
            : formatMinutes(candidate.value),
      achievedAt: candidate.achievedAt,
      isNew: isNewlySet(candidate, stored),
      unavailable:
        candidate.value !== null
          ? null
          : usageBacked && input.usage === null
            ? "no-source"
            : "not-enough-data",
    };
  });

  return {
    unavailable: bests.every((b) => b.unavailable !== null) ? "not-enough-data" : null,
    bests,
    newlySet: bests.filter((b) => b.isNew).map((b) => b.id),
  };
}

/** The records to persist once the user has actually seen them. */
export function acknowledgeRecords(bests: PersonalBest[], now: number): PersonalBestRecord[] {
  return bests
    .filter((b) => b.unavailable === null)
    .map((b) => ({
      id: b.id,
      value: b.value,
      achievedAt: b.achievedAt ?? now,
      seen: true,
    }));
}

export { DAY_MS, addDays };
