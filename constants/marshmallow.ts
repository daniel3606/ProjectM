import {
  computeSessionGrowth,
  roundGrowthCm,
  type SessionGrowthInput,
} from "@/lib/growthModel";

export const MARSHMALLOW_COLORS = [
  { name: "Strawberry", hex: "#FFB5C2" },
  { name: "Classic", hex: "#FFF5EE" },
  { name: "Blue Berry", hex: "#B5D8FF" },
  { name: "Pineapple", hex: "#f5e689" },
  { name: "Grape", hex: "#D4B5FF" },
  { name: "Peach", hex: "#FFD4B5" },
  { name: "Cherry", hex: "#FF9EBF" },
] as const;

export function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export const INITIAL_MARSHMALLOW_SIZE_CM = 2.5;

/**
 * The marshmallow's real size, derived from completed session history.
 *
 * Sums the *awarded* growth — what the soft cap actually paid out — falling
 * back to `expectedGrowthCm` for sessions completed before the growth model
 * separated the two, where the estimate was the award.
 */
export function computeMarshmallowSizeCm(
  sessions: { expectedGrowthCm: number; awardedGrowthCm?: number }[]
): number {
  const totalGrowth = sessions.reduce(
    (sum, s) => sum + (s.awardedGrowthCm ?? s.expectedGrowthCm),
    0
  );
  return roundGrowthCm(INITIAL_MARSHMALLOW_SIZE_CM + totalGrowth);
}

export function getSizeDescription(cm: number): string {
  if (cm < 3) return "A tiny marshmallow seed";
  if (cm < 5) return "A little marshmallow sprout";
  if (cm < 10) return "A small but sweet marshmallow";
  if (cm < 15) return "A growing marshmallow";
  if (cm < 20) return "A healthy fluffy marshmallow";
  if (cm < 30) return "A big cuddly marshmallow";
  if (cm < 50) return "A magnificent marshmallow";
  return "A legendary marshmallow!";
}

export type FocusMode = "flexible" | "deep";

/**
 * What a block is worth if it is completed, as the UI previews it.
 *
 * This is an estimate, not a promise: it prices the block against the day's
 * raw growth *right now*, and the day keeps moving while the block runs. The
 * figure actually awarded is recomputed at completion in `FocusSessionContext`.
 */
export function estimateGrowthCm(input: SessionGrowthInput & { rawGrowthTodayCm?: number }): number {
  return roundGrowthCm(computeSessionGrowth(input).awardedGrowthCm);
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatDaysOfWeek(daysOfWeek: number[]): string {
  if (daysOfWeek.length === 7) return "Every day";
  return [...daysOfWeek]
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS[d])
    .join(", ");
}

export function formatClockTime(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
