export const MARSHMALLOW_COLORS = [
  { name: "Strawberry", hex: "#FFB5C2" },
  { name: "Classic", hex: "#FFF5EE" },
  { name: "Blue Berry", hex: "#B5D8FF" },
  { name: "Mint", hex: "#B5FFCB" },
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
 * Returns expected growth in cm for a given focus duration.
 * Base rate: 0.5cm per 15 minutes. Deep focus applies a 1.5x multiplier.
 */
export function getGrowthForDuration(
  minutes: number,
  mode: FocusMode = "flexible"
): number {
  const baseGrowth = (minutes / 15) * 0.5;
  const multiplier = mode === "deep" ? 1.5 : 1.0;
  return Math.round(baseGrowth * multiplier * 10) / 10;
}

export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
export const DAY_LABELS_FULL = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

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
